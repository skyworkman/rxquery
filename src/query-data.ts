import { BehaviorSubject, Observable, of, Subject, Subscription } from "rxjs"
import {
  catchError,
  debounceTime,
  delay,
  repeat,
  retry,
  startWith,
  switchMap,
  takeUntil,
  tap
} from "rxjs/operators"

type Data<T> = {
  pageIndex: number
  pageSize: number
  searchText?: string
} & T

export class QueryData<QueryParam extends {}, QueryResult> {
  // private
  private readonly p: Data<QueryParam>
  private readonly pageIndexSource = new BehaviorSubject<number>(1)
  private readonly dataSource = new Subject<QueryResult>()
  private destroy$ = new Subject()
  private interval: Subscription | undefined = undefined
  private started = false

  // public
  loading: boolean = false
  data: QueryResult
  parameter: Readonly<Data<QueryParam>>

  static parameters<T>(v: T): T {
    return v
  }

  static create<QueryResult>(
    fetchSource: (q: Data<{}>) => Observable<QueryResult | null | undefined>,
    defaultResult: QueryResult
  ) {
    return new QueryData(fetchSource, defaultResult, {})
  }

  constructor(
    private fetchSource: (q: Data<QueryParam>) => Observable<QueryResult | null | undefined>,
    private defaultResult: QueryResult,
    defaultValue: QueryParam
  ) {
    this.p = { pageIndex: 0, pageSize: 10, ...defaultValue }
    this.data = defaultResult
    this.parameter = this.p
  }

  /**
   * 监听结果变化
   */
  dataChange(): Observable<QueryResult> {
    return this.dataSource
  }

  /**
   * 启用轮询刷新数据
   * @param time 间隔时间
   */
  enableInterval(time: number) {
    if (this.interval != null) {
      return
    }
    this.interval = this.dataSource
      .pipe(
        delay(time),
        startWith(undefined),
        takeUntil(this.destroy$),
        retry(),
        tap(() => this.refresh()),
        repeat()
      )
      .subscribe()
  }

  /**
   * 停止轮询刷新
   */
  stopInterval() {
    if (this.interval) {
      this.interval.unsubscribe()
    }
  }

  start(debounce: number = 500) {
    if (this.started) {
      return
    }
    this.started = true
    // 引入订阅机制, 主要是为了方便是用rxjs的一些操作符, 例如节流等
    this.pageIndexSource
      .pipe(
        takeUntil(this.destroy$),
        tap(_ => (this.loading = true)),
        debounceTime(debounce),
        switchMap(_ => {
          return this.fetchSource(this.p)
        }),
        catchError(error => {
          console.error(error)
          return of(this.defaultResult)
        })
      )
      .subscribe(it => {
        this.loading = false
        this.data = it != null ? it : this.defaultResult
        this.dataSource.next(this.data)
        return this.data
      })
  }

  close() {
    this.destroy$.next()
    this.started = false
  }

  research() {
    this.p.pageIndex = 1
    this.refresh()
  }

  refresh() {
    this.pageIndexSource.next(this.p.pageIndex)
  }

  update(data: QueryResult) {
    this.data = data
    this.dataSource.next(this.data)
  }

  /**
   * 设置查询参数, 但不进行查询,
   * ps: set完毕后, 可以调用 `refresh` 进行查询
   */
  set<KEY extends keyof Data<QueryParam>>(key: KEY, v: Data<QueryParam>[KEY]) {
    this.p[key] = v
    // 当更改了其他它查询参数的时候, 返回到第一页, 重新查询
    if (key !== "pageIndex") {
      this.p.pageIndex = 1
    }
  }

  /**
   * 设置查询参数, 并立即进行查询
   */
  search<KEY extends keyof Data<QueryParam>>(key: KEY, v: Data<QueryParam>[KEY]) {
    this.set(key, v)
    this.refresh()
  }
}
