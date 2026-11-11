'use client';

import {useState} from 'react';
import type {Scores} from '@/lib/analogues';

const channels = [
 {key: 'P', label: 'Pressure', color: '#b44b4b'},
 {key: 'E', label: 'Expansion', color: '#148269'},
 {key: 'V', label: 'Volatility', color: '#bd8c25'},
] as const;
const left = 60;
const right = 860;
const width = 900;
const lastDay = 74;
const ticks = [...Array.from({length: 15}, (_, index) => index * 5), lastDay];
const x = (day: number) => left + day / lastDay * (right - left);

export default function ScorePathComparison({current, past}: {current: Scores[]; past: Scores[]}) {
 const [day, setDay] = useState(0);
 const reference = current[day];
 const historical = past[day];
 const selectDay = (value: number) => setDay(Math.max(0, Math.min(lastDay, value)));

 return <div className="score-path-overlay">
  <p className="quiet">Solid · reference. Dashed · historical match. Both use the same calendar-day offset and a 0–100 score scale.</p>
  <div className="score-path-scrubber">
   <button type="button" className="ghost small" disabled={day===0} onClick={()=>selectDay(day-5)}>−5 days</button>
   <label>
    <strong>Calendar day {day} of {lastDay}</strong>
    <input type="range" min={0} max={lastDay} step={1} value={day}
     aria-valuetext={`Day ${day}, reference ${reference.date}, historical ${historical.date}`}
     onChange={event=>selectDay(Number(event.target.value))}/>
   </label>
   <button type="button" className="ghost small" disabled={day===lastDay} onClick={()=>selectDay(day+5)}>+5 days</button>
  </div>
  <div className="score-path-readings" aria-live="polite">
   <span><strong>Reference {reference.date}</strong> · P {reference.P} · E {reference.E} · V {reference.V}</span>
   <span><strong>Historical {historical.date}</strong> · P {historical.P} · E {historical.E} · V {historical.V}</span>
  </div>
  <svg viewBox={`0 0 ${width} 425`} className="history-svg" role="img"
   aria-label="75-day comparison of reference and historical pressure, expansion and volatility"
   onPointerMove={event=>{
    if(event.pointerType!=='mouse'&&!event.buttons)return;
    const bounds=event.currentTarget.getBoundingClientRect();
    selectDay(Math.round(((event.clientX-bounds.left)/bounds.width*width-left)/(right-left)*lastDay));
   }}>
   {channels.map(({key,label,color},index)=>{
    const top=30+index*130;
    const y=(value:number)=>top+95-value*.85;
    return <g key={key}>
     <text x={left} y={top-2}>{label}</text>
     {[0,50,100].map(value=><g key={value}>
      <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e3e8e2"/>
      <text x={left-8} y={y(value)+4} textAnchor="end">{value}</text>
     </g>)}
     {[current,past].map((rows,series)=><path key={series}
      d={rows.map((row,i)=>`${i?'L':'M'}${x(i)},${y(row[key])}`).join(' ')}
      fill="none" stroke={color} strokeWidth={series?2:2.5} strokeDasharray={series?'6 4':undefined}/>)}
     <circle cx={x(day)} cy={y(reference[key])} r={4} fill={color}/>
     <circle cx={x(day)} cy={y(historical[key])} r={4} fill="white" stroke={color} strokeWidth={2}/>
    </g>;
   })}
   <line x1={x(day)} x2={x(day)} y1={38} y2={389} stroke="#617468" strokeDasharray="3 3"/>
   {ticks.map(tick=><text key={tick} x={x(tick)} y={415} textAnchor="middle">{tick}</text>)}
  </svg>
 </div>;
}
