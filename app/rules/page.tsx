import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BookOpen, Eye, Flag, Swords, Users, Waves, Lightbulb } from "lucide-react";
import { DocPage, DocTable } from "@/components/doc-page";
import { EVIL_COUNTS, PRESETS, ROLES, TEAM_SIZES, rolePool, type Preset, type Role } from "@/lib/game";
import { serverLang, serverT } from "@/lib/i18n/server";

type T = ReturnType<typeof serverT>;

export async function generateMetadata(): Promise<Metadata> {
  const t = serverT(await serverLang());
  return {
    title: t("规则教学 · 圆桌"),
    description: t("阿瓦隆规则速学：流程、人数与任务表、全部角色、湖中仙女与胜负条件。"),
  };
}

const COUNTS = [5, 6, 7, 8, 9, 10] as const;
const BUILT_IN: Exclude<Preset, "custom">[] = ["basic", "classic", "mist", "full"];
const EXPANSION: Role[] = ["goodLancelot", "cleric", "evilLancelot", "lunatic", "brute", "revealer"];
// Display order: good first, then evil, core roles before expansion roles.
const ROLE_ORDER: Role[] = ["merlin", "percival", "loyal", "goodLancelot", "cleric", "assassin", "morgana", "mordred", "oberon", "minion", "evilLancelot", "lunatic", "brute", "revealer"];

function whereToFind(role: Role, t: T): string {
  if (EXPANSION.includes(role)) return t("自定义板子 · 7 人起");
  const presets = BUILT_IN.filter(preset => rolePool(10, preset).includes(role)).map(preset => t(PRESETS[preset].name));
  return presets.length === BUILT_IN.length ? t("所有板子") : t("{presets}，或自定义板子", { presets: presets.join(t("、")) });
}

/** Renders a translated sentence whose <b>…</b> parts are bold, so each language can place emphasis naturally. */
function rich(text: string): ReactNode[] {
  return text.split(/(<b>.*?<\/b>)/).filter(Boolean).map((part, index) => part.startsWith("<b>") ? <strong key={index}>{part.slice(3, -4)}</strong> : part);
}

export default async function RulesPage() {
  const t = serverT(await serverLang());
  return (
    <DocPage
      eyebrow="How to play"
      title={t("十分钟学会阿瓦隆")}
      lead={t("好人要完成三次任务，邪恶要让三次任务失败，或者在最后刺中梅林。每个人都只知道自己的身份，靠讨论、投票和任务结果推理。")}
    >
      <nav aria-label={t("本页目录")}>
        <ul className="doc-toc">
          <li><a href="#flow">{t("一局怎么进行")}</a></li>
          <li><a href="#table">{t("人数与任务表")}</a></li>
          <li><a href="#roles">{t("角色图鉴")}</a></li>
          <li><a href="#sight">{t("谁能看见谁")}</a></li>
          <li><a href="#lake">{t("湖中仙女")}</a></li>
          <li><a href="#win">{t("胜负条件")}</a></li>
          <li><a href="#first">{t("第一次玩")}</a></li>
        </ul>
      </nav>

      <section id="flow">
        <h2><BookOpen size={20} />{t("一局怎么进行")}</h2>
        <ol className="doc-steps">
          <li><strong>{t("入座与发身份")}</strong>{t("房主建房，朋友扫码按实际位置入座并准备。房主发身份后，每人按住查看自己的角色和线索，记住后确认。")}</li>
          <li><strong>{t("队长选队")}</strong>{t("队长按本轮任务人数挑选队员（可以选自己）。大家先讨论，再由队长提交人选。")}</li>
          <li><strong>{t("全员表决")}</strong>{t("所有人对这支队伍投赞成或反对。严格过半才通过，平票算否决。否决后队长交给下一位，连续第五次否决直接判邪恶胜。")}</li>
          <li><strong>{t("秘密执行任务")}</strong>{t("队伍通过后，队员秘密提交任务牌。好人只能出成功；邪恶可以选择成功或失败。只公布失败牌的数量，不公布谁出了什么。")}</li>
          <li><strong>{t("五次任务，三胜为止")}</strong>{t("任务结果记在任务轨道上。任意一方先拿到三次，就进入结算；好人三次成功后，邪恶还有一次刺杀机会。")}</li>
        </ol>
        <p className="doc-callout"><strong>{t("圆桌替你记住一切：")}</strong>{t("谁当过队长、每次表决谁投了什么、每个任务的失败牌数量，都会记在复盘里。任务牌是谁出的，直到游戏结束也不会公开。")}</p>
      </section>

      <section id="table">
        <h2><Users size={20} />{t("人数与任务表")}</h2>
        <p>{t("邪恶人数由总人数决定。第 1–5 次任务需要的队员人数如下；")}<span className="double">{t("红色")}</span>{t("表示这次任务需要两张失败牌才算失败（7 人及以上的第 4 次任务）。")}</p>
        <DocTable caption={t("各人数的阵营与任务人数")}>
          <thead><tr><th scope="col">{t("人数")}</th><th scope="col">{t("正义 / 邪恶")}</th>{[1, 2, 3, 4, 5].map(quest => <th scope="col" key={quest}>{t("任务 {n}", { n: quest })}</th>)}</tr></thead>
          <tbody>
            {COUNTS.map(count => (
              <tr key={count}>
                <th scope="row">{t("{n} 人", { n: count })}</th>
                <td>{count - EVIL_COUNTS[count]} / {EVIL_COUNTS[count]}</td>
                {TEAM_SIZES[count].map((size, index) => <td key={index} className={count >= 7 && index === 3 ? "double" : undefined}>{size}{count >= 7 && index === 3 ? " ×2" : ""}</td>)}
              </tr>
            ))}
          </tbody>
        </DocTable>
        <h3>{t("预设板子")}</h3>
        <ul>
          {BUILT_IN.map(preset => <li key={preset}><strong>{t(PRESETS[preset].name)}</strong>{t("：{hint}。其余位置补为忠臣和爪牙。", { hint: t(PRESETS[preset].hint) })}</li>)}
          <li><strong>{t(PRESETS.custom.name)}</strong>{t("：自己挑选角色。梅林和刺客必选；莫甘娜需要派西维尔；两位兰斯洛特成对加入；扩展角色与湖中仙女限 7 人及以上。")}</li>
        </ul>
      </section>

      <section id="roles">
        <h2><Swords size={20} />{t("角色图鉴")}</h2>
        <div className="role-grid">
          {ROLE_ORDER.map(role => (
            <article key={role} className={`role-card ${ROLES[role].side}`}>
              <h3>{t(ROLES[role].name)}<small>{ROLES[role].side === "good" ? t("正义") : t("邪恶")}</small></h3>
              <p>{t(ROLES[role].description)}</p>
              <p className="role-where">{t("出现在：{where}", { where: whereToFind(role, t) })}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="sight">
        <h2><Eye size={20} />{t("谁能看见谁")}</h2>
        <ul>
          <li>{rich(t("<b>梅林</b>看见所有邪恶玩家，但看不见莫德雷德。"))}</li>
          <li>{rich(t("<b>派西维尔</b>看见梅林和莫甘娜，但分不清谁是谁。"))}</li>
          <li>{rich(t("<b>邪恶玩家</b>互相认识（包括邪恶兰斯洛特），但看不见奥伯伦；<b>奥伯伦</b>也不认识其他邪恶玩家。"))}</li>
          <li>{rich(t("<b>两位兰斯洛特</b>互相知道对方的身份与阵营。本版不使用阵营转换变体。"))}</li>
          <li>{rich(t("<b>牧师</b>知道第一任队长属于正义还是邪恶。"))}</li>
          <li>{rich(t("<b>忠臣</b>和<b>爪牙</b>之外的线索，都在按住身份卡时显示，只有本人能看到。"))}</li>
        </ul>
      </section>

      <section id="lake">
        <h2><Waves size={20} />{t("湖中仙女（可选）")}</h2>
        <p>{t("只在 7 人及以上的自定义板子中可用。第 2、3、4 次任务结束后，令牌持有者私下查验一位还没持有过令牌的玩家，得知对方属于正义还是邪恶，然后把令牌交给对方。查验结果只有查验者能看到，可以如实公布，也可以说谎。")}</p>
      </section>

      <section id="win">
        <h2><Flag size={20} />{t("胜负条件")}</h2>
        <ul>
          <li><strong>{t("邪恶立即获胜")}</strong>{t("：三次任务失败，或同一次任务连续五次组队被否决。")}</li>
          <li><strong>{t("刺杀")}</strong>{t("：好人完成三次任务后，刺客选择一名他认为是梅林的玩家。选中梅林则邪恶获胜，否则正义获胜。刺杀只有一次，提交后不能更改。")}</li>
          <li><strong>{t("刺客随时出刀（本站默认）")}</strong>{t("：建房时默认开启。对局开始后，刺客可以在任意时刻刺杀一次；刺中梅林邪恶立即获胜，刺错正义立即获胜。如果一直没有出刀，好人三次任务成功后照常进入最后刺杀。房主建房时可以关闭，改用官方规则。")}</li>
          <li>{rich(t("特殊任务牌：<b>疯子</b>参加任务时只能出失败；<b>野蛮人</b>在第 4、5 次任务只能出成功；<b>揭露者</b>在第二次任务失败后向全桌公开身份。"))}</li>
        </ul>
      </section>

      <section id="first">
        <h2><Lightbulb size={20} />{t("第一次玩")}</h2>
        <ul>
          <li>{rich(t("新手局建议选<b>基础局</b>或<b>经典局</b>，5–7 人最容易上手。"))}</li>
          <li>{t("好人：多听发言，留意谁总在推同一批人上车，谁在任务失败后急着转移话题。")}</li>
          <li>{t("梅林：知道太多反而危险。引导队伍时说得含蓄一些，别让刺客认出你。")}</li>
          <li>{t("邪恶：不必每次都出失败牌。偶尔放行一轮，可以帮你赢得信任。")}</li>
          <li>{t("讨论时间不限，但表决和出牌都在手机上完成，别让别人看你的屏幕。")}</li>
        </ul>
        <p>{t("规则依据发行商验证的官方规则整理：")}<a href="https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/the-resistance-avalon" rel="noreferrer" target="_blank">{t("The Resistance: Avalon 官方规则")}</a>{t("。")}</p>
      </section>
    </DocPage>
  );
}
