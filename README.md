# UBWEB 任务备注优先级

为 UBWEB 任务页识别当前登录用户认领任务的优先级，并按固定格式写入任务备注开头的 Tampermonkey 用户脚本。

## 脚本声明

- 当前维护：A-hongchen
- 当前版本：1.0.1
- 作用范围：`https://task.ubweb.best/`
- 主要能力：仅读取编辑页中的 `优先级`，并写入编辑页底部 `备注`

脚本不会主动修改任务的其他字段；已存在 `【优先级：1】` 到 `【优先级：6】` 格式前缀时，会和编辑页当前优先级核对，正确则跳过，不正确则修正。

## 安装

安装 Tampermonkey 后打开：

```text
https://raw.githubusercontent.com/A-hongchen/ubweb-task-priority-filter/main/ubweb-task-priority-filter.user.js
```

Tampermonkey 会识别 `.user.js` 并提示安装。

## 更新

更新步骤：

1. 修改 `ubweb-task-priority-filter.user.js`。
2. 提升脚本头里的 `@version`，例如 `1.0.1` -> `1.0.2`。
3. 提交并推送到 GitHub `main` 分支。
4. 用户端在 Tampermonkey 中重新检查更新，或重新打开安装链接覆盖安装。

## 使用方式

1. 打开 UBWEB 任务主页。
2. 在页面筛选区手动选择当前登录用户，并点击原页面的 `搜索`。
3. 确认列表中显示的是当前用户认领的任务。
4. 点击脚本注入的 `添加优先级` 按钮。
5. 确认弹窗后，脚本会逐条打开任务编辑页，读取 `优先级`，并把 `【优先级：X】` 写入 `备注` 开头。

如果备注原本已有内容，优先级会写在原备注内容前面；如果备注已经以 `【优先级：X】` 开头，脚本会核对 X 是否等于编辑页当前优先级，正确则跳过，不正确则替换为正确值。
