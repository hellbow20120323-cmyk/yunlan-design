package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"
	"time"

	"golang.org/x/net/netutil"

	"yunlan/engine/api"
	"yunlan/engine/config"
	"yunlan/engine/plugin"
	"yunlan/engine/service"
	"yunlan/engine/util"
	"yunlan/engine/util/cache"
	"yunlan/engine/util/cpu"
	"yunlan/engine/util/memlimit"

	// 以下是插件的空导入，用于触发各插件的init函数，实现自动注册
	// 添加新插件时，只需在此处添加对应的导入语句即可
	_ "yunlan/engine/plugin/488run"
	_ "yunlan/engine/plugin/5266ys"
	_ "yunlan/engine/plugin/aipan"
	_ "yunlan/engine/plugin/btbtlb"
	_ "yunlan/engine/plugin/buerchen"
	_ "yunlan/engine/plugin/cldi"
	_ "yunlan/engine/plugin/clmao"
	_ "yunlan/engine/plugin/clxiong"
	_ "yunlan/engine/plugin/cyg"
	_ "yunlan/engine/plugin/diduan"
	_ "yunlan/engine/plugin/djgou"
	_ "yunlan/engine/plugin/duanjuw"
	_ "yunlan/engine/plugin/duoduo"
	_ "yunlan/engine/plugin/dy4k"
	_ "yunlan/engine/plugin/dygang"
	_ "yunlan/engine/plugin/dyyj"
	_ "yunlan/engine/plugin/dyyjpro"

	// _ "yunlan/engine/plugin/erxiao"
	_ "yunlan/engine/plugin/erxiaopan"
	_ "yunlan/engine/plugin/feikuai"
	_ "yunlan/engine/plugin/gaoqing888"
	_ "yunlan/engine/plugin/gying"
	_ "yunlan/engine/plugin/haitunsou"
	_ "yunlan/engine/plugin/hdmoli"
	_ "yunlan/engine/plugin/hjzhencai"
	_ "yunlan/engine/plugin/huban"
	_ "yunlan/engine/plugin/hunhepan"
	_ "yunlan/engine/plugin/ikantv"
	_ "yunlan/engine/plugin/jsnoteclub"

	//_ "yunlan/engine/plugin/jupansou"
	_ "yunlan/engine/plugin/jutoushe"
	_ "yunlan/engine/plugin/kkv"
	_ "yunlan/engine/plugin/kpkuang"
	_ "yunlan/engine/plugin/labi"
	_ "yunlan/engine/plugin/leso"
	_ "yunlan/engine/plugin/libvio"
	_ "yunlan/engine/plugin/lingjisp"
	_ "yunlan/engine/plugin/lou1"
	_ "yunlan/engine/plugin/meitizy"
	_ "yunlan/engine/plugin/melost"
	_ "yunlan/engine/plugin/miosou"
	_ "yunlan/engine/plugin/muou"
	_ "yunlan/engine/plugin/nsgame"
	_ "yunlan/engine/plugin/nyaa"
	_ "yunlan/engine/plugin/ouge"
	_ "yunlan/engine/plugin/pan365"
	_ "yunlan/engine/plugin/panlian"
	_ "yunlan/engine/plugin/pansearch"
	_ "yunlan/engine/plugin/qiwei"
	_ "yunlan/engine/plugin/qqpd"
	_ "yunlan/engine/plugin/quark4k"
	_ "yunlan/engine/plugin/quarkres"
	_ "yunlan/engine/plugin/quarksoo"
	_ "yunlan/engine/plugin/quarktv"

	// _ "yunlan/engine/plugin/qupanshe"
	_ "yunlan/engine/plugin/rrbt"
	_ "yunlan/engine/plugin/shandian"
	_ "yunlan/engine/plugin/sopanya"
	_ "yunlan/engine/plugin/sousou"
	_ "yunlan/engine/plugin/susu"
	_ "yunlan/engine/plugin/thepiratebay"
	_ "yunlan/engine/plugin/ting77"
	_ "yunlan/engine/plugin/u3c3"
	_ "yunlan/engine/plugin/wanou"
	_ "yunlan/engine/plugin/weibo"
	_ "yunlan/engine/plugin/woniu"
	_ "yunlan/engine/plugin/xb6v"
	_ "yunlan/engine/plugin/xdpan"
	_ "yunlan/engine/plugin/xiaokupan"
	_ "yunlan/engine/plugin/xiaoyu"
	_ "yunlan/engine/plugin/xiaozhang"
	_ "yunlan/engine/plugin/yingso"
	_ "yunlan/engine/plugin/yulinshufa"
	_ "yunlan/engine/plugin/yunso"
	_ "yunlan/engine/plugin/yunsou"
	_ "yunlan/engine/plugin/zhizhen"
	_ "yunlan/engine/plugin/zlxapp"
	_ "yunlan/engine/plugin/zxzj"
)

// 全局缓存写入管理器
var globalCacheWriteManager *cache.DelayedBatchWriteManager

func main() {
	// 容器内存配额可见：按 cgroup 配额设置 Go 堆软上限（automemlimit 的做法，取配额的 9/10，
	// 留 10% 给 goroutine 栈、运行时结构和堆外内存）。必须在做任何重分配之前执行。
	// 容器外、配额无限、或部署方已显式设置 GOMEMLIMIT 时都是 no-op，理由打在日志里便于核对。
	if limit, reason := memlimit.ApplyFromCgroup(); limit > 0 {
		fmt.Printf("[启动] 堆软上限 GOMEMLIMIT=%dMB（%s）\n", limit/(1<<20), reason)
	} else {
		fmt.Printf("[启动] 未设置堆软上限：%s\n", reason)
	}

	// 初始化应用
	initApp()

	// 启动服务器
	startServer()
}

// initApp 初始化应用程序
func initApp() {
	// 初始化配置
	config.Init()

	// 初始化HTTP客户端
	util.InitHTTPClient()

	// 初始化缓存写入管理器
	var err error
	globalCacheWriteManager, err = cache.NewDelayedBatchWriteManager()
	if err != nil {
		log.Fatalf("缓存写入管理器创建失败: %v", err)
	}
	if err := globalCacheWriteManager.Initialize(); err != nil {
		log.Fatalf("缓存写入管理器初始化失败: %v", err)
	}
	// 将缓存写入管理器注入到service包
	service.SetGlobalCacheWriteManager(globalCacheWriteManager)

	// 延迟设置主缓存更新函数，确保service初始化完成
	go func() {
		// 等待一小段时间确保service包完全初始化
		time.Sleep(100 * time.Millisecond)
		if mainCache := service.GetEnhancedTwoLevelCache(); mainCache != nil {
			globalCacheWriteManager.SetMainCacheUpdater(func(key string, data []byte, ttl time.Duration) error {
				return mainCache.SetBothLevels(key, data, ttl)
			})
		}
	}()

	// 确保异步插件系统初始化
	plugin.InitAsyncPluginSystem()

	// 后台常驻探测 t.me 可达性：被墙时 TG 阶段直接跳过，省掉 111 个必然挂满超时的频道请求。
	// 探测在后台跑，搜索路径只读结论，不引入额外时延。
	service.StartTGReachabilityProbe()
}

// startServer 启动Web服务器
func startServer() {
	// 初始化插件管理器
	pluginManager := plugin.NewPluginManager()

	// 注册全局插件（根据配置过滤）
	if config.AppConfig.AsyncPluginEnabled {
		pluginManager.RegisterGlobalPluginsWithFilter(config.AppConfig.EnabledPlugins)
	}

	// 更新默认并发数（如果插件被禁用则使用0）
	pluginCount := 0
	if config.AppConfig.AsyncPluginEnabled {
		pluginCount = len(pluginManager.GetPlugins())
	}
	config.UpdateDefaultConcurrency(pluginCount)

	// 初始化搜索服务
	searchService := service.NewSearchService(pluginManager)

	// 设置路由
	router := api.SetupRouter(searchService)

	// 获取端口配置
	port := config.AppConfig.Port

	// 输出服务信息
	printServiceInfo(port, pluginManager)

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  config.AppConfig.HTTPReadTimeout,
		WriteTimeout: config.AppConfig.HTTPWriteTimeout,
		IdleTimeout:  config.AppConfig.HTTPIdleTimeout,
	}

	// 创建通道来接收操作系统信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// 在单独的goroutine中启动服务器
	go func() {
		// 如果设置了最大连接数，使用限制监听器
		if config.AppConfig.HTTPMaxConns > 0 {
			// 创建监听器
			listener, err := net.Listen("tcp", srv.Addr)
			if err != nil {
				log.Fatalf("创建监听器失败: %v", err)
			}

			// 创建限制连接数的监听器
			limitListener := netutil.LimitListener(listener, config.AppConfig.HTTPMaxConns)

			// 使用限制监听器启动服务器
			if err := srv.Serve(limitListener); err != nil && err != http.ErrServerClosed {
				log.Fatalf("启动服务器失败: %v", err)
			}
		} else {
			// 使用默认方式启动服务器（不限制连接数）
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("启动服务器失败: %v", err)
			}
		}
	}()

	// 等待中断信号
	<-quit
	fmt.Println("正在关闭服务器...")

	// 优先保存缓存数据到磁盘（数据安全第一）
	// 增加关闭超时时间，确保数据有足够时间保存
	shutdownTimeout := 10 * time.Second

	if globalCacheWriteManager != nil {
		if err := globalCacheWriteManager.Shutdown(shutdownTimeout); err != nil {
			log.Printf("缓存数据保存失败: %v", err)
		}
	}

	// 额外确保内存缓存也被保存（双重保障）
	if mainCache := service.GetEnhancedTwoLevelCache(); mainCache != nil {
		if err := mainCache.FlushMemoryToDisk(); err != nil {
			log.Printf("内存缓存同步失败: %v", err)
		}
	}

	// 设置关闭超时时间
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 优雅关闭服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("服务器关闭异常: %v", err)
	}

	fmt.Println("服务器已安全关闭")
}

// printServiceInfo 打印服务信息
func printServiceInfo(port string, pluginManager *plugin.PluginManager) {
	// 启动服务器
	fmt.Printf("服务器启动在 http://localhost:%s\n", port)

	// 输出代理信息
	hasProxy := false
	if config.AppConfig.ProxyURL != "" {
		proxyType := "代理"
		if strings.HasPrefix(config.AppConfig.ProxyURL, "socks5://") {
			proxyType = "SOCKS5代理"
		} else if strings.HasPrefix(config.AppConfig.ProxyURL, "http://") {
			proxyType = "HTTP代理"
		} else if strings.HasPrefix(config.AppConfig.ProxyURL, "https://") {
			proxyType = "HTTPS代理"
		}
		fmt.Printf("使用%s (PROXY): %s\n", proxyType, util.MaskProxyURL(config.AppConfig.ProxyURL))
		hasProxy = true
	}
	if config.AppConfig.HTTPProxyURL != "" {
		fmt.Printf("使用HTTP代理 (HTTP_PROXY/http_proxy): %s\n", util.MaskProxyURL(config.AppConfig.HTTPProxyURL))
		hasProxy = true
	}
	if config.AppConfig.HTTPSProxyURL != "" {
		fmt.Printf("使用HTTPS代理 (HTTPS_PROXY/https_proxy): %s\n", util.MaskProxyURL(config.AppConfig.HTTPSProxyURL))
		hasProxy = true
	}
	if !hasProxy {
		fmt.Println("未使用代理")
	}

	// 输出并发信息
	if os.Getenv("CONCURRENCY") != "" {
		fmt.Printf("默认并发数: %d (由环境变量CONCURRENCY指定)\n", config.AppConfig.DefaultConcurrency)
	} else {
		channelCount := len(config.AppConfig.DefaultChannels)
		pluginCount := 0
		// 只有插件启用时才计算插件数
		if config.AppConfig.AsyncPluginEnabled && pluginManager != nil {
			pluginCount = len(pluginManager.GetPlugins())
		}
		fmt.Printf("默认并发数: %d (= 频道数%d + 插件数%d + 10)\n",
			config.AppConfig.DefaultConcurrency, channelCount, pluginCount)
	}

	// 输出缓存信息
	if config.AppConfig.CacheEnabled {
		fmt.Printf("缓存已启用: 路径=%s, 最大大小=%dMB, TTL=%d分钟\n",
			config.AppConfig.CachePath,
			config.AppConfig.CacheMaxSizeMB,
			config.AppConfig.CacheTTLMinutes)
	} else {
		fmt.Println("缓存已禁用")
	}

	// 输出压缩信息
	if config.AppConfig.EnableCompression {
		fmt.Printf("响应压缩已启用: 最小压缩大小=%d字节\n",
			config.AppConfig.MinSizeToCompress)
	}

	// 输出GC配置信息
	fmt.Printf("GC配置: 触发阈值=%d%%, 内存优化=%v\n",
		config.AppConfig.GCPercent,
		config.AppConfig.OptimizeMemory)

	// 输出HTTP服务器配置信息
	readTimeoutMsg := ""
	if os.Getenv("HTTP_READ_TIMEOUT") != "" {
		readTimeoutMsg = "(由环境变量指定)"
	} else {
		readTimeoutMsg = "(自动计算)"
	}

	writeTimeoutMsg := ""
	if os.Getenv("HTTP_WRITE_TIMEOUT") != "" {
		writeTimeoutMsg = "(由环境变量指定)"
	} else {
		writeTimeoutMsg = "(自动计算)"
	}

	maxConnsMsg := ""
	if os.Getenv("HTTP_MAX_CONNS") != "" {
		maxConnsMsg = "(由环境变量指定)"
	} else {
		cpuCount := cpu.SchedulableCount()
		maxConnsMsg = fmt.Sprintf("(自动计算: GOMAXPROCS=%d × 200)", cpuCount)
	}

	fmt.Printf("HTTP服务器配置: 读取超时=%v %s, 写入超时=%v %s, 空闲超时=%v, 最大连接数=%d %s\n",
		config.AppConfig.HTTPReadTimeout, readTimeoutMsg,
		config.AppConfig.HTTPWriteTimeout, writeTimeoutMsg,
		config.AppConfig.HTTPIdleTimeout,
		config.AppConfig.HTTPMaxConns, maxConnsMsg)

	// 输出异步插件配置信息
	if config.AppConfig.AsyncPluginEnabled {
		// 检查工作者数量是否由环境变量指定
		workersMsg := ""
		if os.Getenv("ASYNC_MAX_BACKGROUND_WORKERS") != "" {
			workersMsg = "(由环境变量指定)"
		} else {
			cpuCount := cpu.SchedulableCount()
			workersMsg = fmt.Sprintf("(自动计算: GOMAXPROCS=%d × 5)", cpuCount)
		}

		// 检查任务数量是否由环境变量指定
		tasksMsg := ""
		if os.Getenv("ASYNC_MAX_BACKGROUND_TASKS") != "" {
			tasksMsg = "(由环境变量指定)"
		} else {
			tasksMsg = "(自动计算: 工作者数量 × 5)"
		}

		fmt.Printf("异步插件已启用: 响应超时=%d秒, 最大工作者=%d %s, 最大任务=%d %s, 缓存TTL=%d小时\n",
			config.AppConfig.AsyncResponseTimeout,
			config.AppConfig.AsyncMaxBackgroundWorkers, workersMsg,
			config.AppConfig.AsyncMaxBackgroundTasks, tasksMsg,
			config.AppConfig.AsyncCacheTTLHours)
	} else {
		fmt.Println("异步插件已禁用")
	}

	// 只有当插件功能启用时才输出插件信息
	if config.AppConfig.AsyncPluginEnabled {
		plugins := pluginManager.GetPlugins()
		if len(plugins) > 0 {
			// 根据新逻辑，只有指定了具体插件才会加载插件
			fmt.Printf("已启用指定插件 (%d个):\n", len(plugins))

			// 按优先级排序（优先级数字越小越靠前）
			sort.Slice(plugins, func(i, j int) bool {
				// 优先级相同时按名称排序
				if plugins[i].Priority() == plugins[j].Priority() {
					return plugins[i].Name() < plugins[j].Name()
				}
				return plugins[i].Priority() < plugins[j].Priority()
			})

			for _, p := range plugins {
				fmt.Printf("  - %s (优先级: %d)\n", p.Name(), p.Priority())
			}
		} else {
			// 区分不同的情况
			if config.AppConfig.EnabledPlugins == nil {
				fmt.Println("未设置插件列表 (ENABLED_PLUGINS)，未加载任何插件")
			} else if len(config.AppConfig.EnabledPlugins) > 0 {
				fmt.Printf("未找到指定的插件: %s\n", strings.Join(config.AppConfig.EnabledPlugins, ", "))
			} else {
				fmt.Println("插件列表为空 (ENABLED_PLUGINS=\"\")，未加载任何插件")
			}
		}
	}
}
