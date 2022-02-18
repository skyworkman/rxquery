import { Observable } from "rxjs"
import { Data, QueryData } from "./query-data"

export class QueryDataBuilder {
  static create<QueryResult>(fetchSource: (p: Data<{}>) => Observable<QueryResult | null | undefined>, defaultResult: QueryResult) {
    return new QueryData(fetchSource, {
      defaultResult,
      defaultParameters: {}
    })
  }
}
