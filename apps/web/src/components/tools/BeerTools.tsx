import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const cardClass = `${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`;
const inputClass =
  'w-full min-h-10 px-3 py-2 text-[13px] font-mono text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50';
const inputInvalidClass =
  'w-full min-h-10 px-3 py-2 text-[13px] font-mono text-yunlan-ink bg-[#fbfaf7] border border-red-500/60 rounded-sm focus:outline-none focus:border-red-500';
const selectClass =
  'w-full min-h-10 px-3 py-2 text-[13px] text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50';
const presetClass = 'min-h-8 px-2.5 py-1 text-xs rounded-sm border transition-colors';
const smallBtnClass =
  'inline-flex items-center gap-1 min-h-8 px-2.5 py-1 text-xs rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

const L_PER_GAL = 3.785411784;
const G_PER_OZ = 28.349523125;

/** 单位偏好与最近一次输入写入 localStorage，刷新后保持 */
function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(`yunlan.${key}`);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(`yunlan.${key}`, JSON.stringify(value));
    } catch {
      /* 隐私模式下忽略写入失败 */
    }
  }, [key, value]);

  return [value, setValue];
}

function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

function brixToSg(brix: number): number {
  return 1 + brix * 0.004;
}

function srmToRgb(srm: number): string {
  const s = Math.max(0, Math.min(60, srm));
  const r = Math.round(255 * 0.984 * Math.pow(10, -0.02 * s));
  const g = Math.round(255 * 0.964 * Math.pow(10, -0.06 * s));
  const b = Math.round(255 * 0.944 * Math.pow(10, -0.13 * s));
  return `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;
}

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
  error,
  children,
}: {
  label: string;
  value?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] tracking-wide text-yunlan-muted">{label}</label>
        {value ? <span className="font-mono text-[11px] text-yunlan-stone">{value}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
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

function SectionCard({
  id,
  title,
  desc,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cardClass}>
      <ToolHead title={title} desc={desc} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface UnitProps {
  imperial: boolean;
}

const ogError = (sg: number) =>
  Number.isFinite(sg) && sg >= 1 && sg <= 1.2 ? '' : '比重需在 1.000 – 1.200 之间';

/** ABV 酒精度 */
function AbvTool({ imperial }: UnitProps) {
  const [mode, setMode] = usePersistedState<'sg' | 'brix'>('beer.abv.mode', 'sg');
  const [ogSg, setOgSg] = usePersistedState('beer.abv.og', 1.052);
  const [fgSg, setFgSg] = usePersistedState('beer.abv.fg', 1.012);

  const og = mode === 'brix' ? (ogSg - 1) / 0.004 : ogSg;
  const fg = mode === 'brix' ? (fgSg - 1) / 0.004 : fgSg;
  const abv = Math.max(0, (ogSg - fgSg) * 131.25);
  const attenuation = ogSg > 1 ? ((ogSg - fgSg) / (ogSg - 1)) * 100 : 0;
  const ogBad = ogSg < 1 || ogSg > 1.2;
  const fgBad = fgSg < 1 || fgSg > 1.2;

  return (
    <SectionCard
      id="abv"
      title="ABV 酒精度计算器"
      desc="输入初始比重与最终比重，按 (OG − FG) × 131.25 计算酒精度，支持 SG 与 Brix 切换。"
    >
      <div className="flex flex-wrap gap-2">
        {[
          ['sg', 'SG 比重'],
          ['brix', 'Brix 糖度'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id as 'sg' | 'brix')}
            className={`${presetClass} ${
              mode === id
                ? 'bg-yunlan-cta text-white border-yunlan-cta'
                : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === 'sg' ? '初始比重 OG' : '初始糖度 OG'} error={ogBad ? ogError(ogSg) : ''}>
            <input
              type="number"
              step={mode === 'sg' ? 0.001 : 0.1}
              min={mode === 'sg' ? 1 : 0}
              max={mode === 'sg' ? 1.2 : 30}
              className={ogBad ? inputInvalidClass : inputClass}
              value={mode === 'sg' ? ogSg : Number(og.toFixed(1))}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setOgSg(mode === 'sg' ? v : brixToSg(v));
              }}
            />
          </Field>
          <Field label={mode === 'sg' ? '最终比重 FG' : '最终糖度 FG'} error={fgBad ? ogError(fgSg) : ''}>
            <input
              type="number"
              step={mode === 'sg' ? 0.001 : 0.1}
              min={mode === 'sg' ? 1 : 0}
              max={mode === 'sg' ? 1.2 : 30}
              className={fgBad ? inputInvalidClass : inputClass}
              value={mode === 'sg' ? fgSg : Number(fg.toFixed(1))}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setFgSg(mode === 'sg' ? v : brixToSg(v));
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <Stat label="酒精度" value={abv.toFixed(2)} unit="% ABV" accent="text-emerald-700" />
          <Stat label="表观发酵度" value={attenuation.toFixed(1)} unit="%" hint="OG 到 FG 的糖分消耗比例" />
          <Stat label="OG 折算 SG" value={ogSg.toFixed(3)} unit="" hint={`${sgToPlato(ogSg).toFixed(1)} °P`} />
          <Stat label="FG 折算 SG" value={fgSg.toFixed(3)} unit="" hint={`${sgToPlato(fgSg).toFixed(1)} °P`} />
        </div>
      </div>
      {imperial ? <p className="mt-2 text-[11px] text-yunlan-muted">比重为无量纲数值，不随公制/英制切换。</p> : null}
    </SectionCard>
  );
}

interface HopRow {
  id: string;
  grams: number;
  alpha: number;
  minutes: number;
}

/** IBU 苦度（Tinseth） */
function IbuTool({ imperial }: UnitProps) {
  const [volumeL, setVolumeL] = usePersistedState('beer.ibu.volume', 20);
  const [og, setOg] = usePersistedState('beer.ibu.og', 1.05);
  const [hops, setHops] = usePersistedState<HopRow[]>('beer.ibu.hops', [
    { id: 'h1', grams: 30, alpha: 5, minutes: 60 },
  ]);

  const ogBad = og < 1 || og > 1.2;
  const volume = imperial ? volumeL / L_PER_GAL : volumeL;
  const weightUnit = imperial ? 'oz' : 'g';

  const rows = hops.map((hop) => {
    const bu = 1.65 * Math.pow(0.000125, Math.max(0, og - 1));
    const bt = (1 - Math.exp(-0.04 * Math.max(0, hop.minutes))) / 4.15;
    const utilization = bu * bt;
    const ibu = volumeL > 0 ? ((hop.alpha / 100) * hop.grams * 1000 * utilization) / volumeL : 0;
    return { ...hop, utilization, ibu };
  });
  const totalIbu = rows.reduce((sum, row) => sum + row.ibu, 0);

  const updateHop = (id: string, patch: Partial<HopRow>) =>
    setHops((prev) => prev.map((hop) => (hop.id === id ? { ...hop, ...patch } : hop)));

  return (
    <SectionCard
      id="ibu"
      title="IBU 苦度计算器（Tinseth）"
      desc="按批次体积、目标 OG 与每组啤酒花的重量、Alpha 酸和煮沸时间，用 Tinseth 公式累加苦度。"
    >
      <div className="grid grid-cols-2 gap-3 max-w-xl">
        <Field label={imperial ? '批次体积（gal）' : '批次体积（L）'}>
          <input
            type="number"
            min={1}
            step={0.5}
            className={inputClass}
            value={Number(volume.toFixed(2))}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setVolumeL(imperial ? v * L_PER_GAL : v);
            }}
          />
        </Field>
        <Field label="目标 OG" error={ogBad ? ogError(og) : ''}>
          <input
            type="number"
            min={1}
            max={1.2}
            step={0.001}
            className={ogBad ? inputInvalidClass : inputClass}
            value={og}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setOg(Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="mt-4 space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-[11px] text-yunlan-muted px-1">
          <span>重量（{weightUnit}）</span>
          <span>Alpha 酸（%）</span>
          <span>煮沸时间（分钟）</span>
          <span>贡献 IBU</span>
          <span />
        </div>
        {rows.map((hop) => (
          <div key={hop.id} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={Number((imperial ? hop.grams / G_PER_OZ : hop.grams).toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                updateHop(hop.id, { grams: imperial ? v * G_PER_OZ : v });
              }}
              aria-label="啤酒花重量"
            />
            <input
              type="number"
              min={0}
              max={25}
              step={0.1}
              className={inputClass}
              value={hop.alpha}
              onChange={(e) => updateHop(hop.id, { alpha: Number(e.target.value) || 0 })}
              aria-label="Alpha 酸"
            />
            <input
              type="number"
              min={0}
              max={120}
              step={1}
              className={inputClass}
              value={hop.minutes}
              onChange={(e) => updateHop(hop.id, { minutes: Number(e.target.value) || 0 })}
              aria-label="煮沸时间"
            />
            <span className="font-mono text-[13px] text-yunlan-ink">{hop.ibu.toFixed(1)}</span>
            <button
              type="button"
              onClick={() => setHops((prev) => prev.filter((item) => item.id !== hop.id))}
              className="justify-self-end p-2 text-yunlan-muted hover:text-red-600"
              aria-label="删除啤酒花"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setHops((prev) => [
              ...prev,
              { id: `h${Date.now()}`, grams: 20, alpha: 5, minutes: 15 },
            ])
          }
          className={smallBtnClass}
        >
          <Plus className="w-3.5 h-3.5" /> 添加啤酒花
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="总苦度" value={totalIbu.toFixed(1)} unit="IBU" accent="text-emerald-700" />
        <Stat label="啤酒花组数" value={rows.length} unit="组" />
        <Stat
          label="估算风格区间"
          value={totalIbu < 20 ? '低苦度' : totalIbu < 45 ? '常规艾尔' : totalIbu < 70 ? 'IPA' : '双倍 IPA'}
          unit=""
        />
      </div>
    </SectionCard>
  );
}

interface MaltRow {
  id: string;
  grams: number;
  lovibond: number;
}

/** SRM / EBC 颜色（Morey） */
function SrmTool({ imperial }: UnitProps) {
  const [volumeL, setVolumeL] = usePersistedState('beer.srm.volume', 20);
  const [malts, setMalts] = usePersistedState<MaltRow[]>('beer.srm.malts', [
    { id: 'm1', grams: 4000, lovibond: 2 },
    { id: 'm2', grams: 300, lovibond: 60 },
  ]);

  const volumeGal = volumeL / L_PER_GAL;
  const mcu = malts.reduce((sum, malt) => sum + (malt.grams / 453.592) * malt.lovibond, 0) / Math.max(0.1, volumeGal);
  const srm = mcu > 0 ? 1.4922 * Math.pow(mcu, 0.6859) : 0;
  const ebc = srm * 1.97;

  const updateMalt = (id: string, patch: Partial<MaltRow>) =>
    setMalts((prev) => prev.map((malt) => (malt.id === id ? { ...malt, ...patch } : malt)));

  return (
    <SectionCard
      id="srm"
      title="SRM / EBC 颜色计算器（Morey）"
      desc="添加麦芽重量与 Lovibond 色值，按 Morey 公式估算成品色度，并给出直观颜色预览。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-4">
        <div>
          <Field label={imperial ? '批次体积（gal）' : '批次体积（L）'}>
            <input
              type="number"
              min={1}
              step={0.5}
              className={inputClass}
              value={Number((imperial ? volumeGal : volumeL).toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setVolumeL(imperial ? v * L_PER_GAL : v);
              }}
            />
          </Field>

          <div className="mt-4 space-y-2">
            {malts.map((malt) => (
              <div key={malt.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  step={10}
                  className={inputClass}
                  value={Number((imperial ? malt.grams / G_PER_OZ : malt.grams).toFixed(1))}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    updateMalt(malt.id, { grams: imperial ? v * G_PER_OZ : v });
                  }}
                  aria-label="麦芽重量"
                />
                <input
                  type="number"
                  min={0}
                  max={600}
                  step={1}
                  className={inputClass}
                  value={malt.lovibond}
                  onChange={(e) => updateMalt(malt.id, { lovibond: Number(e.target.value) || 0 })}
                  aria-label="Lovibond 色值"
                />
                <button
                  type="button"
                  onClick={() => setMalts((prev) => prev.filter((item) => item.id !== malt.id))}
                  className="justify-self-end p-2 text-yunlan-muted hover:text-red-600"
                  aria-label="删除麦芽"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMalts((prev) => [...prev, { id: `m${Date.now()}`, grams: 500, lovibond: 20 }])}
              className={smallBtnClass}
            >
              <Plus className="w-3.5 h-3.5" /> 添加麦芽
            </button>
            <p className="text-[10px] text-yunlan-muted">
              重量单位跟随全局公制/英制；Lovibond 为麦芽色值（°L）。
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div
            className="h-24 rounded-sm border border-yunlan-hairline"
            style={{ backgroundColor: srmToRgb(srm) }}
            aria-label="成品颜色预览"
          />
          <Stat label="SRM" value={srm.toFixed(1)} unit="" accent="text-emerald-700" />
          <Stat label="EBC" value={ebc.toFixed(1)} unit="" hint={`MCU ${mcu.toFixed(1)}`} />
        </div>
      </div>
    </SectionCard>
  );
}

/** 酵母投放量 */
function YeastTool({ imperial }: UnitProps) {
  const [volumeL, setVolumeL] = usePersistedState('beer.yeast.volume', 20);
  const [og, setOg] = usePersistedState('beer.yeast.og', 1.05);
  const [type, setType] = usePersistedState<'dry' | 'liquid'>('beer.yeast.type', 'dry');
  const [date, setDate] = usePersistedState('beer.yeast.date', new Date().toISOString().slice(0, 10));

  const ogBad = og < 1 || og > 1.2;
  const ageDays = Math.max(0, (Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000);
  const viability = Math.max(0.1, type === 'dry' ? 1 - ageDays * 0.0005 : 1 - ageDays * 0.0035);
  const cellsPerPack = type === 'dry' ? 20 : 100;
  const plato = Math.max(0, sgToPlato(og));
  const cellsNeeded = (0.75 * volumeL * 1000 * plato) / 1000; // 十亿 cells
  const packs = Math.max(1, Math.ceil(cellsNeeded / (cellsPerPack * viability)));
  const starter = type === 'liquid' && cellsNeeded > cellsPerPack * viability;

  return (
    <SectionCard
      id="yeast"
      title="酵母投放量计算器"
      desc="按麦汁体积、目标 OG、酵母类型与生产日期估算所需细胞数、包装数量与是否需要扩培。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={imperial ? '麦汁体积（gal）' : '麦汁体积（L）'}>
            <input
              type="number"
              min={1}
              step={0.5}
              className={inputClass}
              value={Number((imperial ? volumeL / L_PER_GAL : volumeL).toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setVolumeL(imperial ? v * L_PER_GAL : v);
              }}
            />
          </Field>
          <Field label="目标 OG" error={ogBad ? ogError(og) : ''}>
            <input
              type="number"
              min={1}
              max={1.2}
              step={0.001}
              className={ogBad ? inputInvalidClass : inputClass}
              value={og}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setOg(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="酵母类型">
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as 'dry' | 'liquid')}>
              <option value="dry">干酵母（约 20 亿/包）</option>
              <option value="liquid">液体酵母（约 1000 亿/包）</option>
            </select>
          </Field>
          <Field label="生产日期">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <Stat label="建议细胞数" value={cellsNeeded.toFixed(0)} unit="十亿" accent="text-emerald-700" />
          <Stat label="包装数量" value={packs} unit="包" />
          <Stat label="估算存活率" value={(viability * 100).toFixed(0)} unit="%" hint={`约 ${Math.round(ageDays)} 天`} />
          <Stat label="扩培建议" value={starter ? '需要 Starter' : '直接投放'} unit="" hint={type === 'dry' ? '干酵母通常无需扩培' : '液体酵母按存活细胞判断'} />
        </div>
      </div>
    </SectionCard>
  );
}

const PRIMING_STYLES = [
  { label: '英式艾尔（1.8 vol）', vols: 1.8 },
  { label: '美式艾尔（2.4 vol）', vols: 2.4 },
  { label: '德式小麦（3.6 vol）', vols: 3.6 },
  { label: '比利时艾尔（3.0 vol）', vols: 3.0 },
  { label: '世涛 / 波特（2.0 vol）', vols: 2.0 },
  { label: '赛松（3.5 vol）', vols: 3.5 },
];

/** 装瓶补糖 */
function PrimingTool({ imperial }: UnitProps) {
  const [volumeL, setVolumeL] = usePersistedState('beer.priming.volume', 20);
  const [tempC, setTempC] = usePersistedState('beer.priming.temp', 20);
  const [vols, setVols] = usePersistedState('beer.priming.vols', 2.4);
  const [style, setStyle] = usePersistedState('beer.priming.style', '美式艾尔（2.4 vol）');

  const tempF = (tempC * 9) / 5 + 32;
  const residual = Math.max(0, 3.0378 - 0.050062 * tempF + 0.00026555 * tempF * tempF);
  const delta = Math.max(0, vols - residual);
  const glucose = delta * volumeL * 4.0;
  const sucrose = delta * volumeL * 3.8;
  const dme = delta * volumeL * 5.0;

  return (
    <SectionCard
      id="priming"
      title="装瓶补糖计算器"
      desc="按啤酒体积、发酵温度与目标 CO2 体积，计算葡萄糖、蔗糖或干麦芽精的补糖克数。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="目标风格（自动填入 CO2 体积）">
            <select
              className={selectClass}
              value={style}
              onChange={(e) => {
                setStyle(e.target.value);
                const found = PRIMING_STYLES.find((item) => item.label === e.target.value);
                if (found) setVols(found.vols);
              }}
            >
              {PRIMING_STYLES.map((item) => (
                <option key={item.label} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={imperial ? '啤酒体积（gal）' : '啤酒体积（L）'}>
              <input
                type="number"
                min={1}
                step={0.5}
                className={inputClass}
                value={Number((imperial ? volumeL / L_PER_GAL : volumeL).toFixed(2))}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setVolumeL(imperial ? v * L_PER_GAL : v);
                }}
              />
            </Field>
            <Field label={imperial ? '发酵温度（°F）' : '发酵温度（°C）'}>
              <input
                type="number"
                step={0.5}
                className={inputClass}
                value={Number((imperial ? tempF : tempC).toFixed(1))}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setTempC(imperial ? ((v - 32) * 5) / 9 : v);
                }}
              />
            </Field>
          </div>
          <Field label="目标 CO2 体积（vol）" value={`${vols.toFixed(1)} vol`}>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={vols}
              onChange={(e) => setVols(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          <Stat label="残留 CO2" value={residual.toFixed(2)} unit="vol" hint="按发酵温度估算" />
          <Stat label="需补充" value={delta.toFixed(2)} unit="vol" />
          <Stat label="葡萄糖" value={glucose.toFixed(0)} unit="g" accent="text-emerald-700" />
          <Stat label="蔗糖" value={sucrose.toFixed(0)} unit="g" accent="text-emerald-700" />
          <Stat label="干麦芽精（DME）" value={dme.toFixed(0)} unit="g" accent="text-emerald-700" />
          <Stat label="温度折算" value={tempF.toFixed(0)} unit="°F" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-yunlan-muted">
        补糖前请确认发酵已完成；建议先将糖用少量热水溶解并冷却后再混入酒液。
      </p>
    </SectionCard>
  );
}

function kegPsi(tempC: number, vols: number): number {
  const tf = (tempC * 9) / 5 + 32;
  return (
    -16.6999 -
    0.0101059 * tf +
    0.00116512 * tf * tf +
    0.173354 * tf * vols +
    4.24267 * vols -
    0.0684029 * vols * vols
  );
}

/** 生啤强制碳酸化 */
function KegTool({ imperial }: UnitProps) {
  const [tempC, setTempC] = usePersistedState('beer.keg.temp', 3);
  const [vols, setVols] = usePersistedState('beer.keg.vols', 2.5);

  const psi = kegPsi(tempC, vols);
  const temps = [0, 4, 8, 12, 16, 20];
  const volList = [2.0, 2.25, 2.5, 2.75, 3.0];

  return (
    <SectionCard
      id="keg"
      title="生啤强制碳酸化计算器"
      desc="设定目标 CO2 体积与冷藏温度，估算所需气压，并提供温度 × 体积的查表矩阵。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label={imperial ? '冷藏温度（°F）' : '冷藏温度（°C）'} value={`${imperial ? ((tempC * 9) / 5 + 32).toFixed(0) : tempC} °${imperial ? 'F' : 'C'}`}>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={tempC}
              onChange={(e) => setTempC(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
          </Field>
          <Field label="目标 CO2 体积" value={`${vols.toFixed(2)} vol`}>
            <input
              type="range"
              min={1.5}
              max={3.5}
              step={0.05}
              value={vols}
              onChange={(e) => setVols(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
          </Field>
          <Stat label="建议气压" value={Math.max(0, psi).toFixed(1)} unit="PSI" accent="text-emerald-700" hint={`约 ${(Math.max(0, psi) / 14.5038).toFixed(2)} bar`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-yunlan-muted">
                <th className="px-1.5 py-1.5 text-left font-normal">温度</th>
                {volList.map((v) => (
                  <th key={v} className="px-1.5 py-1.5 text-right font-normal">{v.toFixed(2)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {temps.map((t) => (
                <tr key={t} className="border-t border-yunlan-hairline">
                  <td className="px-1.5 py-1.5 text-yunlan-muted">
                    {imperial ? `${((t * 9) / 5 + 32).toFixed(0)}°F` : `${t}°C`}
                  </td>
                  {volList.map((v) => {
                    const cell = kegPsi(t, v);
                    const active = Math.abs(t - tempC) < 0.01 && Math.abs(v - vols) < 0.01;
                    return (
                      <td
                        key={v}
                        className={`px-1.5 py-1.5 text-right font-mono ${
                          active ? 'text-yunlan-cinnabar font-semibold' : 'text-yunlan-ink'
                        }`}
                      >
                        {Math.max(0, cell).toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-yunlan-muted">表格单位 PSI，行为温度、列为目标 CO2 体积。</p>
        </div>
      </div>
    </SectionCard>
  );
}

const LINE_RESISTANCE: Record<string, number> = {
  '3/16': 3.0,
  '1/4': 0.7,
  '5/16': 0.4,
  '3/8': 0.2,
};

/** 管路长度平衡 */
function LineTool({ imperial }: UnitProps) {
  const [psi, setPsi] = usePersistedState('beer.line.psi', 12);
  const [height, setHeight] = usePersistedState('beer.line.height', 0.6);
  const [tube, setTube] = usePersistedState('beer.line.tube', '3/16');

  const heightFt = imperial ? height : height * 3.28084;
  const resistance = LINE_RESISTANCE[tube] || 3;
  const lengthFt = Math.max(0, (psi - heightFt * 0.5) / resistance);
  const lengthM = lengthFt * 0.3048;

  return (
    <SectionCard
      id="line"
      title="管路长度平衡计算器"
      desc="按酒桶压力、龙头与酒桶高度差以及软管内径，推荐防止泡沫过多的酒管长度。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="酒桶压力（PSI）" value={`${psi} PSI`}>
            <input
              type="range"
              min={4}
              max={30}
              step={0.5}
              value={psi}
              onChange={(e) => setPsi(Number(e.target.value))}
              className="w-full accent-yunlan-cinnabar"
            />
          </Field>
          <Field label={imperial ? '龙头与酒桶高度差（ft）' : '龙头与酒桶高度差（m）'}>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className={inputClass}
              value={Number((imperial ? heightFt : height).toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setHeight(imperial ? v : v / 3.28084);
              }}
            />
          </Field>
          <Field label="软管内径">
            <select className={selectClass} value={tube} onChange={(e) => setTube(e.target.value)}>
              <option value="3/16">3/16"（约 3.0 psi/ft）</option>
              <option value="1/4">1/4"（约 0.7 psi/ft）</option>
              <option value="5/16">5/16"（约 0.4 psi/ft）</option>
              <option value="3/8">3/8"（约 0.2 psi/ft）</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <Stat label="推荐管长" value={(imperial ? lengthFt : lengthM).toFixed(2)} unit={imperial ? 'ft' : 'm'} accent="text-emerald-700" />
          <Stat label="高度抵消" value={(heightFt * 0.5).toFixed(1)} unit="PSI" hint="每上升 1 ft 约抵消 0.5 PSI" />
          <Stat label="有效压力" value={Math.max(0, psi - heightFt * 0.5).toFixed(1)} unit="PSI" />
          <Stat label="管阻" value={resistance} unit="psi/ft" />
        </div>
      </div>
    </SectionCard>
  );
}

/** 啤酒热量 */
function CaloriesTool({ imperial }: UnitProps) {
  const [og, setOg] = usePersistedState('beer.cal.og', 1.052);
  const [fg, setFg] = usePersistedState('beer.cal.fg', 1.012);
  const [volumeMl, setVolumeMl] = usePersistedState('beer.cal.volume', 500);

  const ogBad = og < 1 || og > 1.2;
  const fgBad = fg < 1 || fg > 1.2;
  const abv = Math.max(0, (og - fg) * 131.25);
  const serve = imperial ? volumeMl / 473.176 : volumeMl;

  const alcoholG = (volumeMl * abv * 0.789) / 100;
  const alcoholKcal = alcoholG * 7;
  const rePlato = Math.max(0, sgToPlato(fg));
  const carbsG = (volumeMl / 1000) * rePlato * 10;
  const carbKcal = carbsG * 4;

  return (
    <SectionCard
      id="calories"
      title="啤酒热量计算器"
      desc="按 OG、FG 与饮用体积估算总热量，并拆分碳水化合物与酒精贡献。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="OG" error={ogBad ? ogError(og) : ''}>
            <input
              type="number"
              min={1}
              max={1.2}
              step={0.001}
              className={ogBad ? inputInvalidClass : inputClass}
              value={og}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setOg(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="FG" error={fgBad ? ogError(fg) : ''}>
            <input
              type="number"
              min={1}
              max={1.2}
              step={0.001}
              className={fgBad ? inputInvalidClass : inputClass}
              value={fg}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setFg(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label={imperial ? '饮用体积（品脱）' : '饮用体积（ml）'}>
            <input
              type="number"
              min={50}
              step={10}
              className={inputClass}
              value={Number(serve.toFixed(0))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setVolumeMl(imperial ? v * 473.176 : v);
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <Stat label="总热量" value={(alcoholKcal + carbKcal).toFixed(0)} unit="kcal" accent="text-emerald-700" />
          <Stat label="酒精热量" value={alcoholKcal.toFixed(0)} unit="kcal" hint={`${abv.toFixed(1)}% ABV`} />
          <Stat label="碳水热量" value={carbKcal.toFixed(0)} unit="kcal" hint={`${carbsG.toFixed(1)} g 碳水`} />
          <Stat label="等效 12oz" value={((alcoholKcal + carbKcal) * (355 / volumeMl)).toFixed(0)} unit="kcal" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-yunlan-muted">估算值，实际热量受残糖、蛋白质与测量误差影响。</p>
    </SectionCard>
  );
}

/** BAC */
function BacTool({ imperial }: UnitProps) {
  const [sex, setSex] = usePersistedState<'male' | 'female'>('beer.bac.sex', 'male');
  const [weightKg, setWeightKg] = usePersistedState('beer.bac.weight', 70);
  const [volumeMl, setVolumeMl] = usePersistedState('beer.bac.volume', 500);
  const [abv, setAbv] = usePersistedState('beer.bac.abv', 5);
  const [hours, setHours] = usePersistedState('beer.bac.hours', 1);

  const weight = imperial ? weightKg * 2.2046226 : weightKg;
  const serve = imperial ? volumeMl / 473.176 : volumeMl;
  const alcoholG = (volumeMl * abv * 0.789) / 100;
  const r = sex === 'male' ? 0.68 : 0.55;
  const peak = (alcoholG / (weightKg * 1000 * r)) * 100;
  const current = Math.max(0, peak - 0.015 * hours);

  return (
    <SectionCard
      id="bac"
      title="BAC 血液酒精浓度估算器"
      desc="按性别、体重、饮酒量与时长估算血液酒精浓度峰值，仅供了解代谢过程。"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="性别">
            <select className={selectClass} value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')}>
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </Field>
          <Field label={imperial ? '体重（lb）' : '体重（kg）'}>
            <input
              type="number"
              min={30}
              step={1}
              className={inputClass}
              value={Number(weight.toFixed(0))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setWeightKg(imperial ? v / 2.2046226 : v);
              }}
            />
          </Field>
          <Field label={imperial ? '饮用体积（品脱）' : '饮用体积（ml）'}>
            <input
              type="number"
              min={50}
              step={10}
              className={inputClass}
              value={Number(serve.toFixed(2))}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setVolumeMl(imperial ? v * 473.176 : v);
              }}
            />
          </Field>
          <Field label="酒精度（ABV %）">
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              className={inputClass}
              value={abv}
              onChange={(e) => setAbv(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="饮酒持续时长（小时）">
            <input
              type="number"
              min={0}
              max={12}
              step={0.5}
              className={inputClass}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="估算峰值 BAC" value={peak.toFixed(3)} unit="%" accent="text-yunlan-cinnabar" />
            <Stat label="当前估算 BAC" value={current.toFixed(3)} unit="%" />
          </div>
          <div className="px-3 py-3 bg-[#fdf5f4] border border-yunlan-cinnabar/30 rounded-sm">
            <p className="text-[11px] leading-relaxed text-yunlan-cinnabar">
              免责声明：本结果仅为基于 Widmark 公式的粗略估算，受个体代谢、饮食、药物与测量误差影响，不具法律效力。请勿据此判断是否可以驾驶或操作机械；饮酒后请选择代驾或公共交通。
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export const BeerTools: React.FC = () => {
  const [imperial, setImperial] = usePersistedState('beer.units.imperial', false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-[11px] text-yunlan-muted">
          <ClipboardList className="w-3.5 h-3.5" />
          <span>单位偏好会保存在本地，刷新后自动恢复</span>
        </div>
        <div className="flex items-center gap-1">
          {[
            [false, '公制'],
            [true, '英制'],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setImperial(value as boolean)}
              className={`${presetClass} ${
                imperial === value
                  ? 'bg-yunlan-cta text-white border-yunlan-cta'
                  : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AbvTool imperial={imperial} />
      <IbuTool imperial={imperial} />
      <SrmTool imperial={imperial} />
      <YeastTool imperial={imperial} />
      <PrimingTool imperial={imperial} />
      <KegTool imperial={imperial} />
      <LineTool imperial={imperial} />
      <CaloriesTool imperial={imperial} />
      <BacTool imperial={imperial} />
    </>
  );
};
