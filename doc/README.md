# 高级软件开发 Lab1 Phase 1：SVG 编辑器

## 架构方案

### 模块划分

| 模块 | 职责 |
| --- | --- |
| `src/domain/` | 封装图形、容器、几何校验、文档树与结构操作，不依赖 IO |
| `src/application/` | 编辑器会话、Command 命令、撤销重做、显示服务、存储端口 |
| `src/infrastructure/` | SVG XML 编解码、文件系统存储适配器 |
| `src/cli/` | 双引号词法分析、命令分发、REPL 输入输出 |
| `src/main.ts` | 唯一组装入口，连接具体依赖 |
| `test/`、`examples/` | 自动化验收与可回放案例 |

```plantuml
@startuml
package "src/cli" as CLI {
  component "REPL + Dispatcher"
}
package "src/application" as Application {
  component "Session + Commands + History"
}
package "src/domain" as Domain {
  component "Shapes + SvgDocument"
}
package "src/infrastructure" as Infrastructure {
  component "SvgCodec + SvgFileStore"
}
component "main (composition root)" as Main
CLI --> Application
CLI --> Domain
Application --> Domain
Infrastructure --> Application : implements DocumentStore
Infrastructure --> Domain
Main --> CLI
Main --> Application
Main --> Infrastructure
@enduml
```

领域对象以私有字段封装状态：Shape 管理唯一 id、几何和样式；六个具体图形类自己负责构造、移动、克隆与摘要；SvgDocument 维护树结构操作。CLI 无法靠直接修改公共数组完成分组，children 返回只读的数组副本。应用接口中的 ReadResult 等仅作为 IO 数据传递结构，领域行为由图形及文档对象负责。

### 设计模式的选择

- **Command（必选）**：CreateCommand、MoveCommand、GroupCommand 等 10 个具体编辑命令类实现 SnapshotCommand 的 mutate；公共 execute / undo / redo 由基类实现。CommandDispatcher 创建命令、EditorSession 调用 History，领域对象作为 receiver。History 维护两个栈，只有 execute 成功才入栈、清空 redo。
- **Composite**：Shape 抽象统一叶子与 GroupShape；容器以多态递归执行 move / scale / clone，样式遵循 SVG 属性继承。
- **Memento**：编辑命令保留前后文档深拷贝；成功后提交，失败丢弃，避免半完成修改，确保撤销结构顺序与精确浮点值。
- **Factory**：ShapeFactory 是图形类型名到图形类的唯一分派点。
- **依赖倒置 / Adapter**：应用声明 DocumentStore，基础设施实现 SVG 文件读写；测试使用内存替身。

```plantuml
@startuml
interface Command {
  +execute(session)
  +undo(session)
  +redo(session)
}
abstract class SnapshotCommand {
  -before : SvgDocument
  -after : SvgDocument
  #mutate(document)
}
class CreateCommand
class MoveCommand
class GroupCommand
class History
abstract class Shape
class GroupShape
class RectShape
class TextShape
Command <|.. SnapshotCommand
SnapshotCommand <|-- CreateCommand
SnapshotCommand <|-- MoveCommand
SnapshotCommand <|-- GroupCommand
History o-- Command
Shape <|-- GroupShape
Shape <|-- RectShape
Shape <|-- TextShape
GroupShape *-- "0..*" Shape
@enduml
```

原子性流程：深拷贝编辑前文档 → 在候选副本执行 mutate → 完整成功后保存前后快照并替换当前文档 → History 入栈。若任何图形校验、成员查找、数值溢出失败，候选副本丢弃，不发布成功消息。撤销/重做恢复快照副本，不以浮点逆运算近似恢复。保存文件另用同目录临时文件与 rename，遵守已有文件的写权限并保留权限位。

### 依赖方向规则

domain 不得导入其他模块或 Node/XML 库；application 只能依赖 domain 和本层；infrastructure 可依赖 application 的存储端口及 domain；cli 可以依赖 application/domain 和本层，REPL 允许使用 Node 标准输入输出库，但不允许文件 IO 或 XML 库；main 可以组装所有层。测试可访问所有层。通过 TypeScript AST 脚本检查全部源码 import。

仅允许两个按名称分派的注册点：CommandDispatcher（命令名）与 ShapeFactory（图形类型名）。它们是本阶段明确保留的待重构点，后续可改为插件注册；属性校验属于各图形类的属性描述表，不以 tag 分派。

### 变化点假设

1. 增加图形/box 插件：Shape 多态接口和集中 Factory 留入口；本阶段不做动态加载，create box 必须失败。
2. 增加 GUI/agent 通道：复用 application 命令与会话，不依赖 REPL。
3. 文件格式/存储替换：通过 DocumentStore 替换；SVG XML 仅存在于 infrastructure。
4. 撤销性能：当前采用全树快照，适合教学规模；大型文档可将命令内部替换为增量 memento，暂不增加复杂度。
5. 外部 SVG 的完整规范：当前只支持题目六种元素，遇到不能无损解释的内容明确报错，避免悄悄丢图。

## 过程记录

- 初始检查：目录仅有题目，没有代码、Git 仓库及配置好的提交身份；先建立方案与工程骨架，再按领域、应用、IO、测试分步实现。提交作者使用本地自动化标识 `Codex <codex@local.invalid>`，不代表学生身份。
- 语义决策：root 下的 g 按题目规定禁止 ungroup；group 选中父与后代时整条失败；跨父级 group 采用文档深度优先顺序，挂在公共祖先中最早受影响的分支位置，避免依赖输入 id 的顺序。
- 语义决策：只有成功的文档 IO / canvas 改尺寸清空并锁定历史；显示、失败命令均不影响历史；下一条成功编辑解锁。
- 读入迭代：简单地遇到缺 id 就从 rect1 分配，会与文档后面已有的 rect1 冲突；改为第一遍预留所有显式 id，再按文档顺序补齐。回归案例断言首个无名 rect 变为 rect2，显式 rect1 不改名。
- 范式检查：拒绝用 switch(tag) 在 move/scale/导出中区分图形。几何与展示由各具体类多态提供；编解码通过 attributes/textContent/children 统一遍历，仅在 ShapeFactory 集中构造类型。
- 变换决策：背景示例包含嵌套 translate/scale，若读回时忽略 transform 会错位。导入时按 SVG 顺序组合并展开到叶子几何，同时将有效 font-size/stroke-width 缩放到叶子，保留 text-anchor 等展示属性；无法解释的旋转等变换明确拒绝。
- 原子性检验：加入“第一个子图移动成功、第二个子图坐标溢出”的失败场景，确认容器整体位置及历史都未改变。另验证删除整树/跨父级分组仅需一次 undo。
- 文件保存迭代：同目录临时文件+rename 虽可避免半写文件，却可能绕过原文件的只读权限；最终补上写权限检查与权限位保留，加入真实文件回归测试，失败时原始字节不变。
- 验证环境修订：沙箱限制 Node 子进程，最初 --test 仅显示测试文件数量；直接执行测试文件后确认具体案例运行。改用 Node 24 的 --test-isolation=none 展示全部案例，并在允许创建子进程的执行环境验证真实 REPL 子进程；没有跳过功能失败。
- Git：按方案、领域、命令、IO/CLI、验收、最终文档分步提交。用户提供远程 `https://github.com/fsxf/-Lab1.git`，已配置 origin；只读探测返回 `could not read Username for 'https://github.com'`，当前环境未配置 GitHub 凭据，远程推送尚未完成。

以上记录来自本次实际实现和验证，未虚构学生审阅意见或人工讨论。

## 一致性自查

1. **模块划分一致性**：实际目录与初始方案一致。新增 `src/application/commands/` 将每个编辑命令独立成类；新增 `scripts/check-architecture.mjs`、根目录使用指南、可回放命令与自动化测试；未新增运行时架构层。CLI 对 Node readline/stream 的允许依赖已在最终依赖规则中补充说明。
2. **依赖方向一致性**：AST 检查覆盖 33 个源文件、96 条 import，未发现逆向依赖。检查还限制一类一文件、类名与文件名一致，拒绝 switch 分派及顶层过程式函数。抽样：`MoveCommand → SvgDocument + SnapshotCommand`，`EditorSession → DocumentStore + History + SvgDocument`，`SvgFileStore → DocumentStore + SvgCodec + node:fs`，`CommandDispatcher → application + domain`；domain 无 Node/XML/CLI 依赖。
3. **两个保留的分派点**：`CommandDispatcher.commands` 与 `ShapeFactory.definitions`。没有在显示、变换和保存路径新增 tag 到行为的分派表。后续动态命令及 ShapeProvider 插件注册仍为待重构项。
4. **阶段边界**：六种内置类型已实现；box/plugin 动态加载未实现，按题目本阶段约定返回 unknown shape type。导入带 data-kind="box" 的普通 g 保留标记并降级使用。

## 质量保证手段

验收环境为 Node.js 24.11.0；锁文件固定实际依赖版本；全程使用 CPU，无需数据集、GPU 或 VLLM。

```bash
npm ci
npm run check
npm run demo
node dist/src/main.js < examples/all-commands.commands
```

最终结果：**71 项测试通过，0 失败，0 跳过**；TypeScript strict 编译与架构检查通过。完整自动化输出见 [verification.txt](verification.txt)；真实 CLI 输出见 [流程图回放](flowchart-transcript.txt) 与 [全部命令回放](all-commands-transcript.txt)。另用伪终端手动执行 init、create、move、undo、tree，确认交互提示符为 `svg> `，Ctrl-D 正常退出。

| 验收范围 | 证据 |
| --- | --- |
| 六种内置类型、浮点/负坐标、fill/stroke 省略、白名单属性 | editor.test.ts：构造/几何/样式/文本 |
| move/scale 统一递归、删除子树、分组/解组/addto/z-order | editor.test.ts：嵌套结构与顺序断言 |
| 单命令 undo、redo 分支失效、显示跳过、文档 IO 锁定 | editor.test.ts：历史行为与全部 IO 屏障 |
| 错误消息、失败不改状态与历史、溢出回滚 | editor.test.ts：24 类失败命令和中途溢出 |
| SVG 标准 XML、中文/空格/特殊字符、缺 id 防碰撞 | codec.test.ts：round-trip、警告及格式校验 |
| 嵌套变换、展示属性、未知类型及畸形 XML 拒绝 | codec.test.ts：外部输入与阶段边界 |
| 真实文件、含空格路径、记忆路径、保存失败、只读权限 | cli.test.ts：临时目录内 IO 与原字节断言 |
| REPL 出错继续执行、退出码、完整流程图脚本 | cli.test.ts：真实 Node 子进程验收 |
| 模块依赖、一类一文件、无 switch/自由函数分派 | check-architecture.mjs：TypeScript AST 全量检查 |

测试重点验证可观察结果和失败时不变量；快照只用来比对序列化前后状态，不模拟被测命令内部实现。

### 已知取舍

- 快照与逐树查找是 O(n)，历史内存随编辑次数和文档大小增长；本阶段针对教学规模，未设计历史条数限制或持久化撤销日志。
- SVG 是完整标准，本工具仅承诺题目子集及列明的展示属性/变换；未知内容明确失败，不宣称通用 SVG 编辑器。根 viewBox 须是 `0 0 width height`；画布尺寸须大于 0；形状尺寸和半径可为 0。
- group 选择跨父容器的元素时，原 SVG 样式继承关系可能变化；遵循题目“从原父摘出”的结构语义，不自动复制计算样式。组内显式样式保留。
- 因当前服务器缺少 GitHub 凭据，远程提交要求仍待完成。认证配置好后在本目录执行以下命令；不使用 force 推送：

```bash
git push -u origin main
git push origin final
```

最终本地提交处标记 `final`。标签实际创建时间由 Git 记录；题目未给出截止时间，不能据此声称满足课程截止时间要求。
