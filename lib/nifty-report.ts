import {csvRows} from './snapshot.ts';
export function parseNiftyReport(text:string,date:string){
 const rows=csvRows(text.replace(/^\uFEFF/,'')),header=rows[0]||[],names=['Index Name','Index Date','Closing Index Value'];
 if(names.some(n=>!header.includes(n)))throw Error('Not an NSE index report');
 const row=rows.find(r=>r[header.indexOf('Index Name')]?.trim().toLowerCase()==='nifty 50');
 if(!row)throw Error('Index not present');
 if(row[header.indexOf('Index Date')]!==`${date.slice(8,10)}-${date.slice(5,7)}-${date.slice(0,4)}`)throw Error('Report date mismatch');
 const close=Number(row[header.indexOf('Closing Index Value')]);if(!Number.isFinite(close)||close<=0)throw Error('Invalid close');return close;
}
