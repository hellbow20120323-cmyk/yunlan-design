import React, { useState } from 'react';
import { yunlanCardClass } from '../PageShell';

const cardClass = `${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`;
const inputClass =
  'w-full min-h-10 px-3 py-2 text-[13px] font-mono text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50';
const selectClass =
  'w-full min-h-10 px-3 py-2 text-[13px] text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50';
const presetClass =
  'min-h-8 px-2.5 py-1 text-xs rounded-sm border transition-colors';

function ToolHead({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">{title}</h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">{desc}</p>
    </>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] tracking-wide text-yunlan-muted">{label}</label>
        {value ? <span className="font-mono text-[11px] text-yunlan-stone">{value}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Presets({
  items,
  current,
  onPick,
}: {
  items: (string | number)[];
  current: string | number;
  onPick: (value: string | number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((item) => (
        <button
          key={String(item)}
          type="button"
          onClick={() => onPick(item)}
          className={`${presetClass} ${
            String(current) === String(item)
              ? 'bg-yunlan-cta text-white border-yunlan-cta'
              : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40'
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
  accent = 'text-yunlan-ink',
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="px-3 py-2.5 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
      <span className="text-[11px] text-yunlan-muted">{label}</span>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`font-mono text-lg ${accent}`}>{value}</span>
        {unit ? <span className="text-[11px] text-yunlan-muted">{unit}</span> : null}
      </div>
      {hint ? <span className="block mt-0.5 text-[10px] text-yunlan-muted">{hint}</span> : null}
    </div>
  );
}

const TIRE_PRESETS = [
  { id: '2105,26.46', label: '700 × 25c（2105 mm）' },
  { id: '2130,26.69', label: '700 × 28c（2130 mm）' },
  { id: '2155,27.01', label: '700 × 32c（2155 mm）' },
  { id: '2205,27.64', label: '700 × 40c Gravel（2205 mm）' },
  { id: '2117,26.54', label: '650b × 47（2117 mm）' },
  { id: '2312,28.98', label: '29 × 2.25 MTB（2312 mm）' },
  { id: '2075,25.98', label: '26 × 2.0 复古 MTB（2075 mm）' },
];

/** 齿比与行进距离（Gear Inches） */
export const GearRatioTool: React.FC = () => {
  const [chainring, setChainring] = useState(50);
  const [cog, setCog] = useState(17);
  const [tire, setTire] = useState(TIRE_PRESETS[1].id);

  const [circMm, diameterIn] = tire.split(',').map(Number);
  const ratio = chainring / Math.max(1, cog);
  const gearInches = ratio * diameterIn;
  const devMeters = (ratio * circMm) / 1000;

  return (
    <section id="gear" className={cardClass}>
      <ToolHead
        title="齿比与行进距离（Gear Inches）"
        desc="输入牙盘与飞轮齿数，计算齿比、Gear Inches 以及每踩一圈的前进距离。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="牙盘齿数（前）" value={`${chainring} T`}>
            <input
              type="range"
              min={28}
              max={60}
              value={chainring}
              onChange={(e) => setChainring(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets
              items={[34, 40, 50, 52, 54].map((v) => `${v}T`)}
              current={`${chainring}T`}
              onPick={(v) => setChainring(Number(String(v).replace('T', '')))}
            />
          </Field>

          <Field label="飞轮齿数（后）" value={`${cog} T`}>
            <input
              type="range"
              min={9}
              max={52}
              value={cog}
              onChange={(e) => setCog(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets
              items={[11, 14, 17, 21, 28, 34, 42].map((v) => `${v}T`)}
              current={`${cog}T`}
              onPick={(v) => setCog(Number(String(v).replace('T', '')))}
            />
          </Field>

          <Field label="轮组规格">
            <select className={selectClass} value={tire} onChange={(e) => setTire(e.target.value)}>
              {TIRE_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat label="齿比" value={ratio.toFixed(2)} unit=": 1" hint="牙盘转一圈，飞轮转多少圈" />
          <Stat label="Gear Inches" value={gearInches.toFixed(1)} unit="in" hint="传统英制传动比" />
          <Stat
            label="每圈行进距离"
            value={devMeters.toFixed(2)}
            unit="m"
            accent="text-emerald-700"
            hint="Development，每踩踏一圈前进的距离"
          />
          <Stat
            label="轮胎周长"
            value={circMm}
            unit="mm"
            hint={`约 ${diameterIn.toFixed(2)} 英寸滚动直径`}
          />
        </div>
      </div>
    </section>
  );
};

/** 踏频与配速换算（Cadence） */
export const CadenceTool: React.FC = () => {
  const [cadence, setCadence] = useState(90);
  const [ratio, setRatio] = useState(2.94);
  const [circMm, setCircMm] = useState(2130);

  const speedKmh = (cadence * ratio * circMm * 60) / 1_000_000;
  const speedMph = speedKmh / 1.609344;

  return (
    <section id="cadence" className={cardClass}>
      <ToolHead
        title="踏频与配速换算（Cadence）"
        desc="根据踏频、齿比与轮胎周长估算理论车速，可对比不同踏频下的速度区间。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="踏频" value={`${cadence} RPM`}>
            <input
              type="range"
              min={40}
              max={140}
              value={cadence}
              onChange={(e) => setCadence(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets
              items={[60, 75, 90, 105, 120]}
              current={cadence}
              onPick={(v) => setCadence(Number(v))}
            />
          </Field>

          <Field label="齿比（牙盘 ÷ 飞轮）" value={ratio.toFixed(2)}>
            <input
              type="number"
              step={0.05}
              min={0.5}
              max={6}
              className={inputClass}
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value) || 1)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                ['爬坡 50/34', 50 / 34],
                ['巡航 50/17', 50 / 17],
                ['冲刺 54/11', 54 / 11],
              ].map(([label, value]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => setRatio(Number(value))}
                  className={`${presetClass} bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="轮胎周长">
            <select
              className={selectClass}
              value={circMm}
              onChange={(e) => setCircMm(Number(e.target.value))}
            >
              <option value={2105}>700 × 25c（2105 mm）</option>
              <option value={2130}>700 × 28c（2130 mm）</option>
              <option value={2155}>700 × 32c（2155 mm）</option>
              <option value={2205}>700 × 40c Gravel（2205 mm）</option>
              <option value={2117}>650b × 47（2117 mm）</option>
              <option value={2312}>29 × 2.25 MTB（2312 mm）</option>
            </select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="理论车速" value={speedKmh.toFixed(1)} unit="km/h" accent="text-emerald-700" />
            <Stat label="英里时速" value={speedMph.toFixed(1)} unit="mph" />
          </div>
          <div className="px-3 py-3 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
            <span className="text-[11px] text-yunlan-muted">不同踏频下的速度</span>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[75, 85, 95, 105].map((rpm) => {
                const kmh = (rpm * ratio * circMm * 60) / 1_000_000;
                return (
                  <div key={rpm} className="px-1 py-2 bg-yunlan-surface border border-yunlan-hairline rounded-sm">
                    <span className="block text-[10px] text-yunlan-muted">{rpm} RPM</span>
                    <span className="block mt-0.5 font-mono text-[13px] text-yunlan-ink">
                      {kmh.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-yunlan-muted">理论值，未计入风阻、轮胎形变与滑行。</p>
        </div>
      </div>
    </section>
  );
};

/** 链条节数精密计算器 */
export const ChainLengthTool: React.FC = () => {
  const [front, setFront] = useState(50);
  const [rear, setRear] = useState(34);
  const [chainstay, setChainstay] = useState(410);
  const [derailleur, setDerailleur] = useState(true);

  const raw = 2 * (chainstay / 25.4) + front / 2 + rear / 2 + 1 + (derailleur ? 2 : 0);
  const links = Math.max(2, Math.round(raw / 2) * 2);
  const lengthMm = Math.round(links * 25.4);

  return (
    <section id="chain" className={cardClass}>
      <ToolHead
        title="链条节数精密计算器"
        desc="按最大牙盘、最大飞轮与后下叉长度估算链条节数，结果向偶数取整，方便直接截链。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="最大牙盘齿数">
            <input
              type="number"
              min={20}
              max={60}
              className={inputClass}
              value={front}
              onChange={(e) => setFront(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="最大飞轮齿数">
            <input
              type="number"
              min={9}
              max={60}
              className={inputClass}
              value={rear}
              onChange={(e) => setRear(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="后下叉长度（mm）">
            <input
              type="number"
              min={350}
              max={520}
              step={1}
              className={inputClass}
              value={chainstay}
              onChange={(e) => setChainstay(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="传动形式">
            <label className="flex items-center gap-2 min-h-10 px-3 text-[13px] text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm cursor-pointer">
              <input
                type="checkbox"
                checked={derailleur}
                onChange={(e) => setDerailleur(e.target.checked)}
                className="accent-yunlan-cinnabar"
              />
              带后拨
            </label>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat label="建议链节数" value={links} unit="节" accent="text-emerald-700" hint="已向上取偶" />
          <Stat label="链条长度" value={(lengthMm / 10).toFixed(1)} unit="cm" hint={`${lengthMm} mm`} />
          <Stat label="传动齿数差" value={Math.max(0, front - rear)} unit="T" hint="供后拨容齿参考" />
          <Stat label="理论半链节" value={links * 2} unit="半节" hint="1 节 = 1 英寸" />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-yunlan-muted">
        结果为参考值，实际以车架、后拨容齿与实际装配为准；截链前建议再次确认。
      </p>
    </section>
  );
};

/** 轮组与外胎真实周长 */
export const WheelCircTool: React.FC = () => {
  const [bsd, setBsd] = useState(622);
  const [width, setWidth] = useState(28);

  const diameterMm = bsd + 2 * width;
  const diameterIn = diameterMm / 25.4;
  const circMm = Math.round(Math.PI * diameterMm);
  const circIn = circMm / 25.4;
  const revsPerKm = Math.round(1_000_000 / circMm);
  const revsPerMi = Math.round(1_609_344 / circMm);

  return (
    <section id="wheel" className={cardClass}>
      <ToolHead
        title="轮组与外胎真实周长"
        desc="按轮圈 BSD 与胎宽推算滚动直径、真实周长与每公里圈数，可用于码表周长设置。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="轮圈标准">
            <select className={selectClass} value={bsd} onChange={(e) => setBsd(Number(e.target.value))}>
              <option value={622}>700c / 29"（622 mm BSD）</option>
              <option value={584}>650b / 27.5"（584 mm BSD）</option>
              <option value={559}>26" 经典 MTB（559 mm BSD）</option>
              <option value={451}>20" 小轮径 / BMX Race（451 mm）</option>
              <option value={406}>20" 折叠车 / BMX（406 mm）</option>
            </select>
          </Field>

          <Field label="外胎宽度" value={`${width} mm`}>
            <input
              type="range"
              min={20}
              max={65}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets
              items={[25, 28, 32, 40, 45, 57]}
              current={width}
              onPick={(v) => setWidth(Number(v))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat label="滚动直径" value={diameterMm} unit="mm" hint={`${diameterIn.toFixed(2)} 英寸`} />
          <Stat label="真实周长" value={circMm} unit="mm" accent="text-emerald-700" hint={`${circIn.toFixed(1)} 英寸`} />
          <Stat label="每公里圈数" value={revsPerKm} unit="圈" />
          <Stat label="每英里圈数" value={revsPerMi} unit="圈" />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-yunlan-muted">
        码表周长建议填写 {circMm} mm；不同胎压与轮圈内宽会造成少量偏差。
      </p>
    </section>
  );
};

/** 轮胎阻抗最佳胎压 */
export const TirePressureTool: React.FC = () => {
  const [weight, setWeight] = useState(83);
  const [width, setWidth] = useState(28);
  const [tubeless, setTubeless] = useState(false);

  const basePsi = 90 * Math.pow(25 / Math.max(18, width), 1.2) * Math.pow(weight / 83, 0.9);
  const factor = tubeless ? 0.9 : 1;
  const frontPsi = basePsi * 0.92 * factor;
  const rearPsi = basePsi * 1.08 * factor;

  return (
    <section id="pressure" className={cardClass}>
      <ToolHead
        title="轮胎阻抗最佳胎压"
        desc="按系统总重量与胎宽估算公路/砾石车的最佳胎压，兼顾滚动阻力与舒适性。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="系统总重量（人 + 车）" value={`${weight} kg`}>
            <input
              type="range"
              min={45}
              max={140}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets items={[60, 70, 83, 95, 110]} current={weight} onPick={(v) => setWeight(Number(v))} />
          </Field>

          <Field label="外胎宽度" value={`${width} mm`}>
            <input
              type="range"
              min={23}
              max={50}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
            <Presets items={[25, 28, 30, 32, 35, 40]} current={width} onPick={(v) => setWidth(Number(v))} />
          </Field>

          <label className="flex items-center gap-2 text-[13px] text-yunlan-ink cursor-pointer">
            <input
              type="checkbox"
              checked={tubeless}
              onChange={(e) => setTubeless(e.target.checked)}
              className="accent-yunlan-cinnabar"
            />
            真空胎 / 无内胎（建议再低约 10%）
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat
            label="前轮建议"
            value={frontPsi.toFixed(0)}
            unit="psi"
            accent="text-emerald-700"
            hint={`${(frontPsi / 14.5038).toFixed(1)} bar`}
          />
          <Stat
            label="后轮建议"
            value={rearPsi.toFixed(0)}
            unit="psi"
            accent="text-emerald-700"
            hint={`${(rearPsi / 14.5038).toFixed(1)} bar`}
          />
          <Stat label="基准胎压" value={basePsi.toFixed(0)} unit="psi" hint="未分配前后配重" />
          <Stat label="车型参考" value={width >= 32 ? 'Gravel' : 'Road'} unit="" hint={width >= 32 ? '偏低胎压更舒适' : '以滚阻与抓地平衡为主'} />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-yunlan-muted">
        估算值，请以轮胎与轮圈标注的最大/最小胎压为硬性边界；雨天或湿滑路面可再降低 5–10 psi。
      </p>
    </section>
  );
};

/** 爬坡坡度与等级判定 */
export const ClimbTool: React.FC = () => {
  const [gain, setGain] = useState(650);
  const [distance, setDistance] = useState(8.5);

  const distM = distance * 1000;
  const gradient = distM > 0 ? (gain / distM) * 100 : 0;
  const angle = (Math.atan(distM > 0 ? gain / distM : 0) * 180) / Math.PI;

  let category = '未分级';
  if (gain > 8000 || (gradient > 8 && distM > 10000)) category = 'HC 级';
  else if (gain > 5000) category = '1 级';
  else if (gain > 2500) category = '2 级';
  else if (gain > 1200) category = '3 级';
  else if (gain > 500) category = '4 级';

  return (
    <section id="climb" className={cardClass}>
      <ToolHead
        title="爬坡坡度与等级判定"
        desc="输入爬升高度与坡段长度，计算平均坡度、倾角与常用爬坡等级。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="累计爬升（米）" value={`${gain} m`}>
            <input
              type="number"
              min={1}
              max={5000}
              className={inputClass}
              value={gain}
              onChange={(e) => setGain(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="坡段长度（公里）" value={`${distance} km`}>
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              className={inputClass}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value) || 0.1)}
            />
          </Field>
          <div>
            <span className="text-[11px] text-yunlan-muted">经典爬坡预设</span>
            <Presets
              items={['Alpe d’Huez', 'Mont Ventoux', 'Stelvio', '12% 短陡坡']}
              current=""
              onPick={(v) => {
                if (v === 'Alpe d’Huez') {
                  setGain(1061);
                  setDistance(13.8);
                } else if (v === 'Mont Ventoux') {
                  setGain(1535);
                  setDistance(21.4);
                } else if (v === 'Stelvio') {
                  setGain(1808);
                  setDistance(24.3);
                } else {
                  setGain(120);
                  setDistance(1);
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat label="平均坡度" value={gradient.toFixed(2)} unit="%" accent="text-emerald-700" />
          <Stat label="倾角" value={angle.toFixed(2)} unit="°" />
          <Stat label="爬坡等级" value={category} unit="" hint="按累计爬升近似判定" />
          <Stat label="坡度比" value={`1 : ${gradient > 0 ? (100 / gradient).toFixed(1) : '—'}`} unit="" hint="垂直 1 米对应水平距离" />
        </div>
      </div>
    </section>
  );
};

/** 骑行功率估算（Watts） */
export const PowerTool: React.FC = () => {
  const [rider, setRider] = useState(68);
  const [bike, setBike] = useState(8.5);
  const [speed, setSpeed] = useState(32);
  const [gradient, setGradient] = useState(0);
  const [cda, setCda] = useState(0.32);

  const totalKg = rider + bike;
  const v = speed / 3.6;
  const slope = Math.atan(gradient / 100);
  const pGravity = totalKg * 9.80665 * v * Math.sin(slope);
  const pRolling = totalKg * 9.80665 * Math.cos(slope) * 0.004 * v;
  const pAero = 0.5 * 1.205 * cda * Math.pow(v, 3);
  const watts = Math.max(0, (pAero + pRolling + pGravity) / 0.96);
  const wkg = rider > 0 ? watts / rider : 0;

  return (
    <section id="power" className={cardClass}>
      <ToolHead
        title="骑行功率估算（Watts）"
        desc="按体重、车速、坡度与风阻估算平路或爬坡所需机械功率，并拆分阻力来源。"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="骑手体重（kg）">
              <input
                type="number"
                min={30}
                max={250}
                className={inputClass}
                value={rider}
                onChange={(e) => setRider(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="整车重量（kg）">
              <input
                type="number"
                min={4}
                max={45}
                step={0.5}
                className={inputClass}
                value={bike}
                onChange={(e) => setBike(Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <Field label="车速（km/h）" value={`${speed} km/h`}>
            <input
              type="number"
              min={3}
              max={90}
              step={0.5}
              className={inputClass}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) || 0)}
            />
          </Field>

          <Field label="坡度" value={`${gradient}%`}>
            <input
              type="range"
              min={-5}
              max={20}
              step={0.5}
              value={gradient}
              onChange={(e) => setGradient(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
          </Field>

          <Field label="骑行姿势（CdA）">
            <select className={selectClass} value={cda} onChange={(e) => setCda(Number(e.target.value))}>
              <option value={0.32}>手变位 / 普通公路（CdA ≈ 0.32）</option>
              <option value={0.28}>下把位 / 低风阻（CdA ≈ 0.28）</option>
              <option value={0.22}>计时赛 / 气动姿态（CdA ≈ 0.22）</option>
              <option value={0.40}>通勤直把 / 直立（CdA ≈ 0.40）</option>
            </select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="px-3 py-3 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
            <span className="text-[11px] text-yunlan-muted">估算机械功率</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl text-yunlan-ink">{Math.round(watts)}</span>
              <span className="text-sm text-yunlan-muted">Watts</span>
            </div>
            <span className="block mt-1 text-[11px] text-yunlan-muted">
              功率体重比 {wkg.toFixed(2)} W/kg（按骑手体重）
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="风阻" value={Math.round(pAero)} unit="W" />
            <Stat label="滚阻" value={Math.round(pRolling)} unit="W" />
            <Stat label="重力" value={`${pGravity > 0 ? '+' : ''}${Math.round(pGravity)}`} unit="W" />
          </div>

          <p className="text-[11px] text-yunlan-muted">
            估算值，假设无风、铺装路面、滚动阻力系数 0.004、传动效率 96%，实际功率会因环境与器材差异而不同。
          </p>
        </div>
      </div>
    </section>
  );
};
