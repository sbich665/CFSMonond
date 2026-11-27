import { computed } from 'vue'
import { useMonitor } from '../composables/useMonitor.js'

const zh = {
  overview: '服务器总览', allServers: '全部服务器', search: '搜索服务器', region: '区域',
  groups: '分类', ungrouped: '未分类', serverSidebar: '显示服务器侧栏',
  total: '总数', online: '在线', offline: '离线', admin: '管理', settings: '主题设置',
  speedOrder: '网速显示顺序', uploadFirst: '上行在前', downloadFirst: '下行在前',
  lineCount: '线路显示条数', hideLines: '隐藏线路区', adminLink: '显示后台入口',
  autoSave: '修改后自动保存', waiting: '等待保存', saving: '正在保存', saved: '已保存',
  saveFailed: '保存失败，已恢复上次保存的配置', retry: '重试',
  memory: '内存', swap: '虚拟内存', disk: '磁盘', traffic: '流量', cores: '核',
  processes: '进程', boot: '开机时间', agent: '探针', architecture: '架构',
  up: '上行', down: '下行', speed: '实时网速', transfer: '累计流量',
  reachable: '可用', unreachable: '不可用', line: '线路', delay: '延时', loss: '丢包率',
  timeout: '超时', expires: '到期', expiresToday: '今天到期', daysLeft: '剩余 {days} 天',
  daysPast: '已过期 {days} 天', fee: '费用', free: '免费', renewOn: '自动续费开启',
  renewOff: '自动续费关闭', month: '月', quarter: '季', half_year: '半年', year: '年',
  two_years: '2 年', three_years: '3 年', four_years: '4 年', five_years: '5 年',
  opening: '正在读取配置', loading: '正在载入', empty: '没有符合条件的服务器',
  loadError: '读取失败', loginRequired: '此站点需要登录', verify: '请完成人机验证',
  verifyFailed: '验证失败，请重试', widgetFailed: '人机验证组件加载失败',
  reconnecting: '实时连接正在重试', connecting: '正在连接实时更新', disconnected: '实时连接已断开',
  live: '实时', limited: '前 500 台订阅实时更新', paused: '实时连接已暂停，是否继续？',
  continue: '继续实时更新', back: '返回总览', range: '时间范围', history: '资源历史',
  emptyHistory: '此时段暂无历史数据', tenMinutes: '10 分钟', thirtyMinutes: '30 分钟',
  hours: '{hours} 小时', days: '{days} 天', network: '网络与流量', hardware: '资源与进程',
  identity: '节点与系统', probe: '探针与上报', billing: '账单与流量策略', fields: '其他公开字段',
  io: '磁盘 I/O', reports: '最近上报样本', target: '探测目标',
  samples: '采样', reportTs: '上报时间', reportAge: '批次延迟',
  id: '服务器 ID', name: '名称', server_group: '分组', tags: '标签', os: '操作系统',
  kernel_version: '内核版本', boot_time: '开机时间', sort_order: '显示顺序', is_hidden: '可见性',
  cpu: 'CPU 使用率', cpu_cores: 'CPU 核数', cpu_info: 'CPU 型号', load_avg: '平均负载',
  ram_total: '内存总量', ram_used: '内存已用', swap_total: '虚拟内存总量', swap_used: '虚拟内存已用',
  disk_total: '磁盘总量', disk_used: '磁盘已用', interface: '网卡',
  net_in_speed: '下行网速', net_out_speed: '上行网速', net_rx: '累计接收', net_tx: '累计发送',
  net_rx_monthly: '本期接收', net_tx_monthly: '本期发送', rx_correction: '接收修正值', tx_correction: '发送修正值',
  price: '价格', currency: '币种符号', billing_cycle: '计费周期', auto_renewal: '自动续费',
  expire_date: '到期日', traffic_limit: '流量额度', traffic_calc_type: '计费口径',
  reset_day: '重置日期', traffic_alert_percent: '流量告警阈值', traffic_alert_state: '流量告警状态',
  offline_notify_disabled: '停用离线通知', agent_version: '探针版本', collect_interval: '采集间隔',
  report_interval: 'HTTP 上报间隔', wss_report_interval: 'WSS 上报间隔', connection_mode: '连接模式',
  ping_mode: '探测方式', last_updated: '最近上报', timestamp: '节点时间戳',
  history_partition_id: '历史分区 ID', long_history_points: '长历史采样点数',
  read_bps: '读取速率', write_bps: '写入速率', read_iops: '读取 IOPS', write_iops: '写入 IOPS',
  await_ms: '平均等待时间', util: 'I/O 使用率', enabled: '启用', disabled: '关闭',
  shown: '公开', hidden: '隐藏', dl: '下行', ul: '上行', max: '取双向较大值', combined: '双向合计',
  databaseUpgradeRequired: '监控后台需要升级数据库'
}

const en = {
  overview: 'Servers', allServers: 'All servers', search: 'Search servers', region: 'Regions',
  groups: 'Groups', ungrouped: 'Ungrouped', serverSidebar: 'Show server sidebar',
  total: 'Total', online: 'Online', offline: 'Offline', admin: 'Admin', settings: 'Theme settings',
  speedOrder: 'Speed display order', uploadFirst: 'Upload first', downloadFirst: 'Download first',
  lineCount: 'Probe lines', hideLines: 'Hide probe panel', adminLink: 'Show admin link',
  autoSave: 'Changes save automatically', waiting: 'Waiting to save', saving: 'Saving', saved: 'Saved',
  saveFailed: 'Could not save. Previous settings restored.', retry: 'Retry',
  memory: 'Memory', swap: 'Swap', disk: 'Storage', traffic: 'Traffic', cores: 'cores',
  processes: 'Processes', boot: 'Boot time', agent: 'Agent', architecture: 'Architecture',
  up: 'Upload', down: 'Download', speed: 'Live rate', transfer: 'Total transfer',
  reachable: 'available', unreachable: 'unavailable', line: 'Probe', delay: 'Latency', loss: 'Loss',
  timeout: 'Timeout', expires: 'Expires', expiresToday: 'Expires today', daysLeft: '{days} days left',
  daysPast: 'Expired {days} days ago', fee: 'Fee', free: 'Free', renewOn: 'Auto-renew on',
  renewOff: 'Auto-renew off', month: 'month', quarter: 'quarter', half_year: '6 months', year: 'year',
  two_years: '2 years', three_years: '3 years', four_years: '4 years', five_years: '5 years',
  opening: 'Loading settings', loading: 'Loading', empty: 'No matching servers',
  loadError: 'Could not load', loginRequired: 'This site requires sign-in', verify: 'Complete the security check',
  verifyFailed: 'Verification failed. Try again.', widgetFailed: 'Could not load Turnstile',
  reconnecting: 'Reconnecting', connecting: 'Connecting', disconnected: 'Disconnected',
  live: 'Live', limited: 'First 500 servers live', paused: 'Live updates paused. Continue?',
  continue: 'Resume live updates', back: 'Back to servers', range: 'Time range', history: 'Resource history',
  emptyHistory: 'No history in this range', tenMinutes: '10 min', thirtyMinutes: '30 min',
  hours: '{hours} h', days: '{days} d', network: 'Network and traffic', hardware: 'Resources and processes',
  identity: 'Server and system', probe: 'Probe and reporting', billing: 'Billing and quota', fields: 'Other public fields',
  io: 'Disk I/O', reports: 'Latest report samples', target: 'Target',
  samples: 'Samples', reportTs: 'Report time', reportAge: 'Report age',
  id: 'Server ID', name: 'Name', server_group: 'Group', tags: 'Tags', os: 'Operating system',
  kernel_version: 'Kernel', boot_time: 'Boot time', sort_order: 'Sort order', is_hidden: 'Visibility',
  cpu: 'CPU usage', cpu_cores: 'CPU cores', cpu_info: 'CPU model', load_avg: 'Load average',
  ram_total: 'Memory total', ram_used: 'Memory used', swap_total: 'Swap total', swap_used: 'Swap used',
  disk_total: 'Storage total', disk_used: 'Storage used', interface: 'Interface',
  net_in_speed: 'Download rate', net_out_speed: 'Upload rate', net_rx: 'Received', net_tx: 'Sent',
  net_rx_monthly: 'Period received', net_tx_monthly: 'Period sent', rx_correction: 'Receive adjustment', tx_correction: 'Send adjustment',
  price: 'Price', currency: 'Currency', billing_cycle: 'Billing cycle', auto_renewal: 'Auto-renew',
  expire_date: 'Expiry date', traffic_limit: 'Traffic quota', traffic_calc_type: 'Quota basis',
  reset_day: 'Reset day', traffic_alert_percent: 'Traffic alert threshold', traffic_alert_state: 'Traffic alert',
  offline_notify_disabled: 'Offline notification disabled', agent_version: 'Agent version', collect_interval: 'Sampling interval',
  report_interval: 'HTTP report interval', wss_report_interval: 'WSS report interval', connection_mode: 'Connection mode',
  ping_mode: 'Probe mode', last_updated: 'Last report', timestamp: 'Server timestamp',
  history_partition_id: 'History partition ID', long_history_points: 'History sample count',
  read_bps: 'Read rate', write_bps: 'Write rate', read_iops: 'Read IOPS', write_iops: 'Write IOPS',
  await_ms: 'I/O wait', util: 'I/O utilization', enabled: 'Enabled', disabled: 'Disabled',
  shown: 'Public', hidden: 'Hidden', dl: 'Download', ul: 'Upload', max: 'Larger direction', combined: 'Both directions',
  databaseUpgradeRequired: 'The monitor database needs an upgrade'
}

export function useLabels() {
  const { sites } = useMonitor()
  const locale = computed(() => {
    const value = sites[0]?.config?.default_language
    return (value && value !== 'auto' ? value : navigator.language).toLowerCase().startsWith('zh') ? 'zh' : 'en'
  })
  function t(key, values = {}) {
    let message = (locale.value === 'zh' ? zh : en)[key] || key
    for (const [name, value] of Object.entries(values)) message = message.replace('{' + name + '}', String(value))
    return message
  }
  return { locale, t }
}
