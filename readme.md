## 一个基于 rxjs 简单的查询工具

### Angular 组件使用示例

```html
<!-- 查询 -->
<input
  type="text"
  placeholder="搜索"
  [ngModel]="q.parameter.searchText"
  (ngModelChange)="q.search('searchText', $event)"
/>
<button (click)="searchOnlyEnable()">只显示启用状态数据</button>

<!-- list -->
<div *ngFor="let item of q.data">{{ item.name }}</div>
```

```ts
type State = "enable" | "disable"
export class UsersComponent implements OnInit, OnDestroy {
  q = new QueryData(
    p => {
      // return http.getUsers("enable") // right
      // return http.getUsers("1") // error
      return this.userService.getUsers(p.state) // right
    },
    { total: 0, items: [] },
    QueryData.parameters<{ state?: State }>({})
  )

  constructor(private userService: AgentsQueryService) {}

  ngOnInit() {
    // 必须: 开始查询
    this.q.start()

    // 可选: 每3秒刷新数据
    // this.q.enableInterval(3000)
  }

  searchOnlyEnable() {
    this.q.search("state", "enable")
  }

  ngOnDestroy() {
    // 必须: 释放
    this.q.close()
  }
}
```
