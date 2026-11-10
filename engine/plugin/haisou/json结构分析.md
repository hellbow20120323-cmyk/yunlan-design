# Haisou 搜索API JSON结构分析

## 接口信息

- **接口名称**: 海搜网盘资源搜索API
- **接口地址**: `https://haisou.cc/api/pan/share/search` (搜索API)
- **辅助接口**: `https://haisou.cc/api/pan/share/{hsid}/fetch` (链接获取API)
- **请求方法**: `GET`
- **Content-Type**: `application/json`
- **主要特点**: 支持按网盘类型分类搜索，需要两步API调用获取完整链接信息

## 请求结构

### 搜索API请求格式

```
GET https://haisou.cc/api/pan/share/search?query={keyword}&scope=title&pan={type}&page={page}&filter_valid=true&filter_has_files=false
```

### 搜索请求参数说明

| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | - | 搜索关键词，需要URL编码 |
| `scope` | string | 否 | "title" | 搜索范围，固定为"title" |
| `pan` | string | 否 | 全部 | 网盘类型过滤 |
| `page` | int | 否 | 1 | 页码，从1开始 |
| `filter_valid` | bool | 否 | true | 过滤有效链接 |
| `filter_has_files` | bool | 否 | false | 过滤包含文件的分享 |

### 链接获取API请求格式

```
GET https://haisou.cc/api/pan/share/{hsid}/fetch
```

| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `hsid` | string | 是 | 从搜索结果中获取的海搜ID |

## 响应结构

### 搜索API响应格式

```json
{
  "code": 0,
  "msg": null,
  "data": {
    "query": "凡人修仙传",
    "count": 64,
    "time": 3,
    "pages": 7,
    "page": 1,
    "list": [
      {
        "hsid": "nlSwOaKeLW",
        "platform": "tianyi",
        "share_name": "\u003Cspan class=\"highlight\"\u003E凡人\u003C/span\u003E\u003Cspan class=\"highlight\"\u003E修仙\u003C/span\u003E\u003Cspan class=\"highlight\"\u003E传\u003C/span\u003E",
        "stat_file": 65,
        "stat_size": 81843197420
      }
    ]
  }
}
```

### 搜索API响应字段详解

#### 1. 基本信息

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `code` | int | 状态码，0表示成功 |
| `msg` | string/null | 错误信息，成功时为null |

#### 2. 数据信息 (data)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `query` | string | 搜索关键词 |
| `count` | int | 搜索结果总数 |
| `time` | int | 搜索耗时（毫秒） |
| `pages` | int | 总页数 |
| `page` | int | 当前页码 |
| `list` | array | 搜索结果列表 |

#### 3. 搜索结果项 (list)

```json
{
  "hsid": "nlSwOaKeLW",
  "platform": "tianyi",
  "share_name": "\u003Cspan class=\"highlight\"\u003E凡人\u003C/span\u003E\u003Cspan class=\"highlight\"\u003E修仙\u003C/span\u003E\u003Cspan class=\"highlight\"\u003E传\u003C/span\u003E",
  "stat_file": 65,
  "stat_size": 81843197420
}
```

| 字段名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `hsid` | string | 是 | 海搜ID，用于获取具体链接 |
| `platform` | string | 是 | 网盘类型标识 |
| `share_name` | string | 是 | 分享名称，可能包含HTML高亮标签 |
| `stat_file` | int | 是 | 文件数量 |
| `stat_size` | int64 | 是 | 总大小（字节） |

### 链接获取API响应格式

```json
{
  "code": 0,
  "msg": null,
  "data": {
    "share_code": "RBRniaAVJbEb",
    "share_pwd": null
  }
}
```

#### 链接获取响应字段详解

| 字段名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `code` | int | 是 | 状态码，0表示成功 |
| `msg` | string/null | 否 | 错误信息，成功时为null |
| `data.share_code` | string | 是 | 网盘分享码 |
| `data.share_pwd` | string/null | 否 | 网盘提取密码，可能为null |

## 支持的网盘类型

| 网盘类型 | API标识 | 域名特征 | 链接格式 |
|---------|---------|----------|----------|
| **阿里云盘** | `ali` | alipan.com | `https://www.alipan.com/s/{share_code}` |
| **百度网盘** | `baidu` | pan.baidu.com | `https://pan.baidu.com/s/{share_code}` |
| **夸克网盘** | `quark` | pan.quark.cn | `https://pan.quark.cn/s/{share_code}` |
| **迅雷网盘** | `xunlei` | pan.xunlei.com | `https://pan.xunlei.com/s/{share_code}` |
| **天翼云盘** | `tianyi` | cloud.189.cn | `https://cloud.189.cn/t/{share_code}` |

## 数据特点

### 1. HTML标签处理 🏷️
- `share_name` 字段包含HTML高亮标签
- 格式：`<span class="highlight">关键词</span>`
- 需要清理HTML标签获取纯文本标题

### 2. 分页机制 📄
- 支持分页搜索，每页包含若干结果
- 通过 `pages` 字段判断总页数
- 页码从1开始递增

### 3. 两阶段API调用 🔄
- 第一阶段：搜索API获取 `hsid` 列表
- 第二阶段：链接获取API获取实际分享码
- 需要并发处理提高效率

### 4. 网盘分类搜索 🗂️
- 可按网盘类型精确搜索
- 不指定 `pan` 参数返回所有类型结果
- 支持多种主流网盘平台

## 重要特性

### 1. 分类搜索 🔍
- 按网盘类型分别搜索
- 支持5种主流网盘平台
- 可并发搜索多个网盘类型

### 2. 异步获取 ⚡
- 搜索阶段快速返回hsid列表
- 链接获取阶段并发处理
- 提高整体搜索效率

### 3. 文件信息 📊
- 提供文件数量统计
- 提供总大小信息
- 便于用户筛选资源

### 4. 高亮显示 🌟
- 搜索结果中关键词高亮
- HTML标签标识匹配部分
- 提升用户体验

## 提取逻辑

### 搜索请求构建
```go
type SearchAPIResponse struct {
    Code int    `json:"code"`
    Msg  string `json:"msg"`
    Data struct {
        Query string      `json:"query"`
        Count int         `json:"count"`
        Time  int         `json:"time"`
        Pages int         `json:"pages"`
        Page  int         `json:"page"`
        List  []ShareItem `json:"list"`
    } `json:"data"`
}

type ShareItem struct {
    HSID      string `json:"hsid"`      // 海搜ID
    Platform  string `json:"platform"`  // 网盘类型
    ShareName string `json:"share_name"` // 分享名称
    StatFile  int    `json:"stat_file"` // 文件数量
    StatSize  int64  `json:"stat_size"` // 总大小
}
```

### 链接获取响应解析
```go
type FetchAPIResponse struct {
    Code int    `json:"code"`
    Msg  string `json:"msg"`
    Data struct {
        ShareCode string  `json:"share_code"` // 分享码
        SharePwd  *string `json:"share_pwd"`  // 密码
    } `json:"data"`
}
```

### 链接还原
```go
// 根据平台类型和分享码构建完整链接
func buildShareURL(platform, shareCode string) string {
    switch strings.ToLower(platform) {
    case "ali":
        return fmt.Sprintf("https://www.alipan.com/s/%s", shareCode)
    case "baidu":
        return fmt.Sprintf("https://pan.baidu.com/s/%s", shareCode)
    case "quark":
        return fmt.Sprintf("https://pan.quark.cn/s/%s", shareCode)
    case "xunlei":
        return fmt.Sprintf("https://pan.xunlei.com/s/%s", shareCode)
    case "tianyi":
        return fmt.Sprintf("https://cloud.189.cn/t/%s", shareCode)
    default:
        return ""
    }
}
```

### HTML标签清理
```go
// 清理HTML高亮标签
func cleanHTMLTags(text string) string {
    // 移除高亮标签
    re := regexp.MustCompile(`<span[^>]*class="highlight"[^>]*>(.*?)</span>`)
    cleaned := re.ReplaceAllString(text, "$1")
    
    // 移除其他HTML标签
    re2 := regexp.MustCompile(`<[^>]*>`)
    cleaned = re2.ReplaceAllString(cleaned, "")
    
    return strings.TrimSpace(cleaned)
}
```

## 错误处理

### 常见错误类型
1. **搜索API错误**: 网络连接失败或API服务错误
2. **链接获取失败**: hsid无效或链接已失效
3. **JSON解析错误**: 响应格式不符合预期
4. **网盘类型不支持**: 未知的platform类型

### 容错机制
- **部分失败容忍**: 搜索失败时不影响其他网盘类型
- **链接获取重试**: 对失败的hsid进行重试
- **数据验证**: 验证hsid和share_code有效性
- **降级处理**: API错误时返回已获取的部分结果

## 性能优化建议

1. **并发搜索**: 同时搜索多种网盘类型，提高效率
2. **分页控制**: 根据需要限制每种网盘类型的搜索页数
3. **缓存策略**: 对hsid到链接的映射实现缓存
4. **超时设置**: 合理设置搜索和链接获取的超时时间
5. **批量处理**: 对多个hsid进行批量链接获取

## 开发注意事项

1. **优先级设置**: 建议设置为优先级2，数据质量良好
2. **Service层过滤**: 使用标准的Service层过滤，不跳过
3. **HTML处理**: 正确处理share_name中的HTML标签
4. **密码分离**: 密码作为独立字段，不拼接到URL中
5. **链接格式**: 严格按照各网盘的标准格式构建链接
6. **错误日志**: 详细记录API调用失败的原因和上下文
7. **请求头设置**: 设置合适的User-Agent和Referer避免反爬虫
8. **重试机制**: 对临时失败的请求实现指数退避重试

## API调用示例

### 搜索请求示例
```bash
curl "https://haisou.cc/api/pan/share/search?query=%E5%87%A1%E4%BA%BA%E4%BF%AE%E4%BB%99%E4%BC%A0&scope=title&pan=tianyi&page=1&filter_valid=true&filter_has_files=false"
```

### 链接获取请求示例
```bash
curl "https://haisou.cc/api/pan/share/nlSwOaKeLW/fetch"
```

### 完整流程示例
1. **搜索各网盘类型**: 并发请求5种网盘类型的搜索结果
2. **收集hsid**: 从所有搜索结果中提取hsid列表
3. **批量获取链接**: 并发调用链接获取API
4. **组合结果**: 将搜索信息与链接信息合并
5. **格式化输出**: 转换为云览引擎标准格式返回
