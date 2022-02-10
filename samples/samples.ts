import { Observable, of } from "rxjs"
import { QueryData } from "../src/query-data"

interface Users {
  name: string
}

const http = {
  getUsers(pageIndex?: "a" | "b" | "c"): Observable<Users[]> {
    return of([])
  }
}

const q = new QueryData(
  p => {
    // return http.getUsers("a") // right
    // return http.getUsers("1") // error
    return http.getUsers(p.state) // right
  },
  [],
  QueryData.parameters<{ state?: "b" | "c" }>({})
)
