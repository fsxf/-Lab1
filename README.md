# 高级软件开发 Lab1：SVG 编辑器 CLI

按 [Phase 1 题目](phase_cli_1.md) 实现。包含六种内置图形、全部 19 条命令、事务式撤销重做、SVG 文件读写、测试及 [实验文档](doc/README.md)。

## 运行

需要 Node.js **24 或更新版本**及 npm。在本目录下执行：

```bash
npm ci
npm run cli
```

交互模式显示 `svg> `，输入 `help` 查看语法，Ctrl-D / EOF 退出。第一次使用先执行 `init` 或 `read`。非交互模式省略提示符；失败命令输出一行 `error:` 后继续执行后续命令，最终退出码为 1；全部成功为 0。

```text
init 800 600
create g scene
create rect r1 20 20 120 60 #4a90d9 in scene
create text t1 40 55 "Hello SVG" in scene
move scene 50 30
undo
redo
tree
save demo.svg
```

`save` 生成标准 SVG，使用浏览器打开即可预览。`save` 不带参数复用最近一次成功 `read` / `save` 的路径。文件路径和文本中的空格使用双引号；支持 `\"` 和 `\\`；仅整行开头的 `#` 是注释，因此 `#4a90d9` 可以作为颜色。

## 验证与案例

```bash
npm run check
npm run demo
node dist/src/main.js < examples/all-commands.commands
```

- `npm run check`：strict 编译、功能测试、真实 CLI / 文件 IO 验收、依赖方向及一类一文件检查。
- `examples/flowchart.commands`：题目两节点流程图；输出 `examples/flowchart.svg`。
- `examples/all-commands.commands`：覆盖所有命令的成功路径；输出 `examples/all-shapes.svg`。
- `examples/other.svg`：题目的外部 SVG，包含缺失 id，可执行 `read examples/other.svg` 验证警告。
- `doc/flowchart-transcript.txt`、`doc/all-commands-transcript.txt`：实际运行记录。

## 约定与边界

所有图形和 g 容器的 id 唯一且区分大小写。失败命令保持当前文档、路径与两个历史栈。成功的 init/read/save/修改 canvas 会清空并锁定撤销重做；下一次成功编辑解锁。canvas 无参数和 tree/show/help 不影响历史。

`front` 移到兄弟列表末尾（SVG 最后绘制，在视觉最前方）；`back` 移到开头。group 按原文档深度优先顺序收编，挂在最近公共祖先中最早受影响的分支位置；ungroup 按题目要求拒绝根级 g，嵌套 g 的子节点提升并占据其原位置。容器 move/scale 递归更改子孙几何，容器 set 样式采用 SVG 继承。

读入支持六种元素、文本实体、常用展示属性、嵌套 translate 和正数等比 scale；变换展开到几何坐标，并保留受缩放影响的文字大小和描边宽度。缺 id 的元素按标签名分配，预留全文已有 id，打印警告。其余图形、混合文本 tspan、旋转、非等比缩放、CSS/style、非匹配 viewBox、DTD 等未覆盖内容明确拒绝，防止静默丢失。允许无 xmlns 的简单 SVG，保存时统一写标准命名空间。`create box` 属后续阶段，本阶段按要求报未知类型；已有 `data-kind="box"` 的 g 作为普通 g 读入。

Git 开发过程及提交说明见 [实验文档](doc/README.md)。远程地址为 `https://github.com/fsxf/-Lab1`。
