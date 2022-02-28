# 一个基于 rxjs 简单的查询工具

## 安装

```bash
npm install @skywosafe/rxquery
```

## 示例

### 1. 无自定义查询参数

无自定义查询参数时可用，适用于只使用自带查询参数即可实现功能的场景

```ts
const q = QueryData.createDefault(p =>
  this.userService.searchUser(
    // p.pageIndex 是框架自带的查询参数
    pageIndex: p.pageIndex,
    ..
  }).pipe(
    map(it => {
      return it.data.users
    })
  ),
  { total: 0, items: [] }
)
```

### 2. 携带自定义查询参数

```ts
type State = "enable" | "disbale" | "active"
const q = QueryData.create(
  // 自定义查询参数的类型，这里我们定义state是可选的，所以默认可以不传
  QueryData.parameters<{ state?: State }>({}),
  p => {
    return this.userService.searchUser({
      pageIndex: p.pageIndex,
      // 我们可以在这里使用 p.state 使用自定义的查询参数
      state: p.state,
      ...
    }).pipe(
      map(it => {
        const data = it.data.users
        this.cache.clear() // PS: 可以做些额外的事情
        return data
      })
    )
  },
  { total: 0, items: [] }
)
```

无自定义查询参数时可用，一般情况下使用

```ts
const q = QueryData.createDefault(p =>
  this.userService.searchUser({ pageIndex: p.pageIndex, ...}).pipe(
    map(it => {
      return it.data.users
    })
  ),
  { total: 0, items: [] }
)
```

### 2. Angular 组件使用示例

```html
<!-- 查询 -->
<input
  type="text"
  placeholder="搜索"
  [ngModel]="q.parameter.searchText"
  (ngModelChange)="q.search('searchText', $event)"
/>
<button (click)="searchForOnlyEnabled()">只显示启用状态数据</button>

<!-- list -->
<div *ngFor="let item of q.data.items">{{ item.name }}</div>
```

```ts
export class UsersComponent implements OnInit, OnDestroy {
  q = QueryData.createDefault(p =>
    this.userService.searchUser({ pageIndex: p.pageIndex, ...}).pipe(
      map(it => {
        return it.data.users
      })
    ),
    { total: 0, items: [] }
  )

  constructor(private userService: AgentsQueryService) {}

  ngOnInit() {
    // 必须: 开始查询
    this.q.subscribe()

    // 可选: 每3秒刷新数据
    // this.q.enableInterval(3000)
  }

  searchForOnlyEnabled() {
    this.q.search("state", "enable")
  }

  ngOnDestroy() {
    // 必须: 释放
    this.q.close()
  }
}
```
