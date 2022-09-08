import { BehaviorSubject, Observable, of, Subject, Subscription } from "rxjs"
import {
  catchError,
  debounceTime,
  delay,
  map,
  repeatWhen,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators"

export type Data<T> = {
  pageIndex: number
  pageSize: number
  searchText?: string
} & T

export interface QueryDataConfig<QueryParam, QueryResult> {
  defaultResult: QueryResult
  defaultParameters: QueryParam
  debounceTime?: number
  pageIndexOffset?: number
}

class QueryDataConfigProvider {
  /**
   * 接口上的坐标，相对于界面的坐标偏移多少，例如api要求pageIndex从0开始， 界面表格要求pageIndex在1开始
   * 请求接口时，页码默认偏移 0 位
   * @see pageIndexBegin
   */
  pageIndexOffset: number = 0
  /**
   * 页码默认从 1 开始
   * 暂时不提供改变，因为页码一般都是从1开始
   * @private
   */
  pageIndexBegin: number = 1
  debounceTime: number = 300
}

export const defaultQueryDataConfig = new QueryDataConfigProvider()

export class QueryData<QueryParam extends {}, QueryResult> {
  // private
  private readonly p: Data<QueryParam>
  // pageIndexSource
  private readonly dataTrigger = new BehaviorSubject<"fetch" | "interval">("fetch")
  readonly dataTrigger$ = this.dataTrigger.asObservable()
  private destroy$ = new Subject()
  closed: Observable<unknown> = this.destroy$

  private interval: Subscription | undefined = undefined
  private started = false

  // public
  get loading(): boolean {
    return this.fetching || this.updating
  }

  private fetching: boolean = false
  updating: boolean = false

  data: QueryResult

  /**
   * 不能直接更改查询参数，只能引用，更改查询参数请看以下函数：
   * @see search
   */
  get parameter(): Readonly<Data<QueryParam>> {
    return this.p
  }

  private readonly dataObservable: Observable<QueryResult>

  /**
   * 接口上的坐标，相对于界面的坐标偏移多少，例如api要求pageIndex从0开始， 界面表格要求pageIndex在1开始
   * 请求接口时，页码默认偏移 0 位
   * @see pageIndexBegin
   */
  private readonly pageIndexOffset: number
  /**
   * 页码默认从 1 开始
   * 暂时不提供改变，因为页码一般都是从1开始
   * @private
   */
  private readonly pageIndexBegin: number = defaultQueryDataConfig.pageIndexBegin
  private readonly dataSource = new Subject<QueryResult>()
  private readonly defaultResult: QueryResult
  private readonly debounceTime: number

  constructor(
    private fetchSource: (q: Data<QueryParam>) => Observable<QueryResult | null | undefined>,
    config: QueryDataConfig<QueryParam, QueryResult>
  ) {
    this.defaultResult = config.defaultResult
    this.data = config.defaultResult
    this.pageIndexOffset = config.pageIndexOffset ?? defaultQueryDataConfig.pageIndexOffset
    this.p = { pageIndex: this.pageIndexBegin, pageSize: 10, ...config.defaultParameters }
    this.debounceTime = config.debounceTime ?? defaultQueryDataConfig.debounceTime

    // 引入订阅机制, 主要是为了方便是用rxjs的一些操作符, 例如节流等
    this.dataObservable = this.dataTrigger$.pipe(
      takeUntil(this.destroy$),
      tap(it => {
        if (it === "fetch") {
          this.fetching = true
        }
      }),
      debounceTime(this.debounceTime),
      switchMap(it => {
        return this.fetchData().pipe(
          catchError(error => {
            console.error("query-data 错误, 已忽略, 并使用默认值代替结果.", error)
            return of(this.defaultResult)
          })
        )
      }),
      catchError(error => {
        console.error("query-data 错误, 已忽略, 并使用默认值代替结果.", error)
        return of(this.defaultResult)
      }),
      map(it => {
        this.data = it != null ? it : this.defaultResult
        return this.data
      }),
      tap(_ => {
        this.dataSource.next(this.data)
        this.fetching = false
        this.updating = false
      }),
      shareReplay(1)
    )
  }

  static createDefault<R>(
    fetchSource: (p: Data<{}>) => Observable<R | null | undefined>,
    defaultResult: R
  ): QueryData<{}, R> {
    return new QueryData(fetchSource, {
      defaultParameters: {},
      defaultResult
    })
  }

  static parameter<Q>(parameters: Q) {
    return {
      create: <R>(
        fetchSource: (p: Data<Q>) => Observable<R | null | undefined>,
        defaultResult: R
      ): QueryData<Q, R> => {
        return new QueryData(fetchSource, {
          defaultParameters: parameters,
          defaultResult
        })
      }
    }
  }

  static create<R>(
    fetchSource: (p: Data<{}>) => Observable<R | null | undefined>,
    defaultResult: R
  ): QueryData<{}, R> {
    return new QueryData(fetchSource, {
      defaultParameters: {},
      defaultResult
    })
  }

  private fetchData() {
    return this.fetchSource({
      ...this.p,
      // 请求接口时的页码可能需要偏移
      pageIndex: this.p.pageIndex + this.pageIndexOffset
    })
  }
  /**
   * 监听结果变化
   */
  dataChange(): Observable<QueryResult> {
    return this.dataSource.asObservable()
  }

  /**
   * 启用轮询刷新数据
   * @param time 间隔时间
   */
  enableInterval(time: number) {
    if (this.interval != null) {
      return
    }
    this.interval = of(undefined)
      .pipe(
        takeUntil(this.destroy$),
        repeatWhen(it => it.pipe(switchMap(_ => this.dataObservable.pipe(delay(time))))),
        tap(() => {
          this.dataTrigger.next("interval")
        })
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

  subscribe() {
    if (this.started) {
      return
    }
    this.started = true
    this.dataObservable.subscribe()
  }

  close() {
    this.destroy$.next()
    this.started = false
  }

  research() {
    this.p.pageIndex = this.pageIndexBegin
    this.refresh()
  }

  refresh() {
    this.dataTrigger.next("fetch")
  }

  /**
   * 设置查询参数, 但不进行查询,
   * ps: set完毕后, 可以调用 `refresh` 进行查询
   */
  set<KEY extends keyof Data<QueryParam>>(key: KEY, v: Data<QueryParam>[KEY]) {
    this.p[key] = v
    // 当更改了其他它查询参数的时候, 返回到第一页, 重新查询
    if (key !== "pageIndex") {
      this.p.pageIndex = this.pageIndexBegin
    }
  }

  /**
   * 更新, 更新成功后, 按照指定方法, 更新数据
   */
  update(action: Observable<QueryResult | null | undefined>): void {
    this.updating = true
    action
      .pipe(
        take(1),
        catchError(it => {
          return of(null)
        })
      )
      .subscribe(it => {
        this.updating = false
        if (it != null) {
          this.data = it
        }
      })
  }

  /**
   * 设置查询参数, 并立即进行查询
   */
  search<KEY extends keyof Data<QueryParam>>(key: KEY, v: Data<QueryParam>[KEY]) {
    this.set(key, v)
    this.refresh()
  }
}
