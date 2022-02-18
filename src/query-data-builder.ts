import { Observable } from "rxjs"
import { Data, QueryData, QueryDataConfig } from "./query-data"

export class QueryDataBuilder {
  static create<QueryResult>(fetchSource: (p: Data<{}>) => Observable<QueryResult | null | undefined>) {
    return {
      withConfig: <Ta extends {}>(config: QueryDataConfig<Ta, QueryResult>) => {
        return new QueryData<Ta, QueryResult>(fetchSource, config)
      },
      withResult: (defaultResult: QueryResult) => {
        return new QueryData<{}, QueryResult>(fetchSource, {
          defaultResult,
          defaultParameters: {}
        })
      }
    }
  }
}
