/* 富国杯答疑工具 — 运行配置
 * 本地演示模式：双击 admin.html 即用，数据存浏览器 localStorage，口令见下（仅演示）。
 * 云端模式：部署 CloudBase 时，填 envId 并把 mode 设为 'cloudbase'（或留 'auto' 自动识别），
 *          口令改由云函数环境变量 ADMIN_PASSCODE 校验，此处的 localPasscode 不再生效。
 */
window.APP_CONFIG = {
  mode: 'cloudbase',            // 'local' | 'cloudbase' | 'auto'
  envId: 'fgcup-8888-d8gdhbbwg2fcef261',               // CloudBase 环境ID，部署时填写
  envExpiresAt: '2027-04-15',  // 环境（体验版）到期日；续费/转套餐后在控制台确认新到期日并更新此值
  localPasscode: 'fg2026'  // 仅本地演示模式生效；上线前请修改
};
