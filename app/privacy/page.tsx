import type { Metadata } from "next";
import { Clock, Cookie, Database, EyeOff, Server, Smartphone } from "lucide-react";
import { DocPage, DocTable } from "@/components/doc-page";

export const metadata: Metadata = {
  title: "隐私说明 · 圆桌",
  description: "圆桌保存哪些数据、保存多久、谁能看到，以及我们不做什么。",
};

export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Privacy"
      title="隐私说明"
      lead="圆桌只保存让一局游戏跑起来所必需的最少信息，房间 24 小时后自动删除。没有账号，没有广告，没有第三方统计。"
    >
      <p className="doc-callout"><strong>简单来说：</strong>你的昵称和本局记录只给同桌的人看；身份和任务牌由服务器保密；房间过期后数据一并删除。</p>

      <section id="collect">
        <h2><Database size={20} />我们保存什么</h2>
        <DocTable caption="服务器上的房间数据">
          <thead><tr><th scope="col">内容</th><th scope="col">用途</th><th scope="col">谁能看到</th></tr></thead>
          <tbody>
            <tr><td>昵称、座位、准备状态</td><td>显示圆桌座位</td><td>同桌玩家，以及持有邀请链接的人</td></tr>
            <tr><td>角色与身份线索</td><td>发身份、判定规则</td><td>只有本人；结局后同桌成员可看全部角色</td></tr>
            <tr><td>组队与表决记录</td><td>复盘</td><td>同桌成员（表决收齐后公开）</td></tr>
            <tr><td>任务牌</td><td>判定任务成败、防止重复提交</td><td>任何人都看不到谁出了什么，只公布失败牌数量</td></tr>
            <tr><td>设备凭据的摘要</td><td>确认“这台手机是几号座位”</td><td>无人可见；服务器只存 SHA-256 摘要</td></tr>
            <tr><td>换设备恢复码</td><td>换手机后回到原座位</td><td>只有本人</td></tr>
            <tr><td>换设备记录</td><td>防止冒用座位</td><td>同桌成员（只含座位和方式）</td></tr>
          </tbody>
        </DocTable>
        <p>房主 Key 只在建房时用来核对，不会写进房间记录、日志或浏览器存储。我们不收集手机号、邮箱、真实姓名、位置、通讯录或照片。</p>
      </section>

      <section id="device">
        <h2><Cookie size={20} />这台设备上保存什么</h2>
        <ul>
          <li><strong>Cookie <code>avalon_device</code></strong>：一串随机凭据，让服务器认出你的座位。仅限本站、HttpOnly（网页脚本读不到）、30 天有效。清除后需要用恢复码或请房主批准才能回到座位。</li>
          <li><strong>本地存储</strong>：你上次用的昵称、最近一个房间码，以及该房间的邀请口令，方便刷新或重开时自动回到房间。点“离开房间”会清掉房间码。</li>
          <li><strong>我的板子模板</strong>：你保存的自定义板子（名称和角色组合，最多 8 个），只存在这台设备，不上传服务器。</li>
          <li><strong>离线提示页</strong>：安装到主屏幕后，只缓存一个公开的“网络已断开”页面，不缓存房间、身份或投票。</li>
        </ul>
        <p>本站不使用任何跟踪 Cookie、广告标识或第三方统计脚本。</p>
      </section>

      <section id="retention">
        <h2><Clock size={20} />保存多久</h2>
        <ul>
          <li><strong>房间</strong>：创建后 24 小时过期，随后在每小时一次的清理中删除；同房再开和中止对局不会延长期限。</li>
          <li><strong>防刷限流记录</strong>：只保存网络地址或设备凭据的摘要和计数，最长 24 小时，同样每小时清理。</li>
          <li><strong>服务日志</strong>：记录请求编号、动作类型、状态码和耗时，房间码只记匿名摘要，不记昵称、Cookie、Key、恢复码或身份。日志由 Cloudflare 按其保留期保存（免费方案目前为 3 天）。</li>
        </ul>
        <p>圆桌没有永久战绩。需要留存复盘，请在结局页用“复制复盘文字”或“下载 .txt”自行导出；导出内容包含同桌昵称、身份和表决，但不包含谁出了哪张任务牌。</p>
      </section>

      <section id="hidden">
        <h2><EyeOff size={20} />对局中的保密</h2>
        <ul>
          <li>每台手机只收到自己该看到的内容；房主在结局前也看不到别人的身份。</li>
          <li>表决收齐后才公开每个人的选择；任务牌与玩家的对应关系，结局后也不公开。</li>
          <li>实时同步只推送“房间有更新”的版本号，手机再通过同样的权限校验读取自己的视图。</li>
          <li>只输入房间码、没有邀请链接的人，看不到同桌的昵称。</li>
        </ul>
      </section>

      <section id="processor">
        <h2><Server size={20} />服务由谁提供</h2>
        <p>圆桌运行在 Cloudflare Workers 上，数据存放在 Cloudflare D1 数据库。Cloudflare 作为基础设施提供方处理网络请求，其做法见 <a href="https://www.cloudflare.com/privacypolicy/" rel="noreferrer" target="_blank">Cloudflare 隐私政策</a>。圆桌不把数据出售或提供给任何其他第三方，也不调用 AI 服务。</p>
      </section>

      <section id="choices">
        <h2><Smartphone size={20} />你可以做什么</h2>
        <ul>
          <li>在大厅点“离开房间”，你的座位和昵称会从房间中移除；游戏开始后，本局记录保留到房间过期。</li>
          <li>清除本站的 Cookie 和网站数据，即可删掉这台设备上的全部信息。</li>
          <li>有疑问或想提前删除某个房间，请联系组织这局游戏的房主，由房主转告站点运营者。</li>
        </ul>
        <p className="doc-lead">最后更新：2026 年 9 月 23 日</p>
      </section>
    </DocPage>
  );
}
