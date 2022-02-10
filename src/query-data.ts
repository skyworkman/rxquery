import { BehaviorSubject, Observable, of, Subject, Subscription } from "rxjs"
import {
  catchError,
  debounceTime,
  delay,
  mergeMap,
  repeat,
  retry,
  switchMap,
  takeUntil,
  tap
} from "rxjs/operators"
type Data<T> = {
  pageIndex: number
  pageSize: number
  searchText?: string
} & T

type Test<T extends {}> = {
  [key in keyof T]: string
}
// interface Test<T extends {}> {
//   [key in keyof T] : string
// }
interface LooseObject<T> {
  [key: string]: any
}

export class QueryData<QueryParam extends {}, QueryResult> {
  private readonly p: Data<QueryParam>
  loading: boolean = false
  private readonly pageIndexSource = new BehaviorSubject<number>(1)
  private readonly dataSource = new Subject<QueryResult>()
  private destroy$ = new Subject()
  private interval: Subscription | undefined = undefined
  private started = false
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

  private getData(pageIndex: number) {
    this.pageIndexSource.next(pageIndex)
  }

  dataChange(): Observable<QueryResult> {
    return this.dataSource
  }

  enableInterval(time: number) {
    if (this.interval != null) {
      return
    }
    this.interval = this.pageIndexSource
      .pipe(
        mergeMap(it => this.dataSource),
        takeUntil(this.destroy$),
        retry(),
        delay(time),
        repeat()
      )
      .subscribe()
  }

  stopInterval() {
    if (this.interval) {
      this.interval.unsubscribe()
    }
  }

  start() {
    if (this.started) {
      return
    }
    // 引入订阅机制, 主要是为了方便是用rxjs的一些操作符, 例如节流等
    this.pageIndexSource
      .pipe(
        takeUntil(this.destroy$),
        tap(_ => (this.loading = true)),
        debounceTime(500),
        switchMap(_ => {
          // this.q.offset = (this.q.pageIndex - 1) * this.q.pageSize
          return this.fetchSource(this.p)
        }),
        catchError(error => {
          console.error(error)
          return of(this.defaultResult)
        })
      )
      .subscribe(it => {
        this.loading = false
        this.data = it != null ? it!! : this.defaultResult
        this.dataSource.next(this.data)
        return this.data
      })
  }

  close() {
    this.destroy$.next()
  }

  get<KEY extends keyof Data<QueryParam>>(key: KEY): Data<QueryParam>[KEY] {
    return this.p[key]
  }

  research() {
    this.getData(1)
  }

  refresh() {
    this.getData(this.pageIndexSource.value)
  }

  update(data: QueryResult) {
    this.data = data
    this.dataSource.next(this.data)
  }

  search<KEY extends keyof Data<QueryParam>>(key: KEY, v: Data<QueryParam>[KEY], research: boolean = true) {
    this.p[key] = v
    if (research) {
      this.getData(1)
    }
  }
}
