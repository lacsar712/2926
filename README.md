# 数据生产线可视化平台

## 🛠 技术栈

- Frontend: Vue 3 + Element Plus + Vue Flow + ECharts
- Backend: Node.js + Express
- Database: MySQL 8.0
- 容器化: Docker Compose

## 🚀 启动指南 (How to Run)

1. 确保 Docker Desktop 已启动
2. 在根目录执行：
```bash
docker compose up -d --build
```
3. 等待所有容器启动完成（约1-2分钟）

## 🔗 服务地址 (Services)

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/health
- Database: localhost:3306 (user: pipeline_user / pass: pipeline_pass_2024)

## 🧪 测试账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 管理员 | admin | 123456 | 全部权限 |
| 编辑者 | zhangsan | 123456 | 编辑权限 |
| 查看者 | lisi | 123456 | 查看权限 |

## 📋 功能验证 (Verification)

1. 访问 http://localhost:3000 ，使用 admin / 123456 登录
2. **生产线管理**：查看生产线列表，支持按名称搜索、状态/标签筛选，可新建/编辑/删除生产线
3. **生产线编排**：点击"编排"进入画布，左侧拖拽组件到画布，连线组件，右侧配置参数，支持保存/检查/发布/历史
4. **生产线监控**：查看统计看板、吞吐量图表、运行记录，点击详情查看节点数据流转和输入输出样例
5. **系统管理**：用户管理（增删改查+角色分配）、标签管理（颜色选择）、操作日志查看

## 📁 项目结构

```
2926/
├── docker-compose.yml          # Docker 编排
├── db/
│   └── init.sql                # 数据库初始化 + 种子数据
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js              # Express 入口
│       ├── middleware/auth.js   # JWT 认证
│       ├── utils/
│       │   ├── db.js           # MySQL 连接池
│       │   └── logger.js       # Winston 日志
│       └── routes/
│           ├── auth.js         # 登录认证
│           ├── pipeline.js     # 生产线 CRUD
│           ├── flow.js         # 编排数据
│           ├── monitor.js      # 监控数据
│           ├── tag.js          # 标签管理
│           ├── user.js         # 用户管理
│           └── log.js          # 操作日志
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/index.js
        ├── styles/global.css
        ├── utils/request.js
        ├── layout/AppLayout.vue
        └── views/
            ├── Login.vue
            ├── pipeline/
            │   ├── PipelineList.vue
            │   └── PipelineFlow.vue
            ├── monitor/
            │   ├── MonitorDashboard.vue
            │   └── MonitorDetail.vue
            └── system/
                ├── UserManage.vue
                ├── TagManage.vue
                └── LogManage.vue
```
