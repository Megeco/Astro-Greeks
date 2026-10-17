import csv,json,pathlib,datetime as dt,hashlib,zipfile,io,sys
ROOT=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/scratch/a041dd74e253');DEST=pathlib.Path(__file__).resolve().parent.parent/'data';days={};sources=[]
folders=['sept2023-timing','april2024-reveal','may2024-reveal','june2024-reveal','july2024-reveal','august-entry-comparison']
for folder in folders:
 p=ROOT/folder/'daily-inputs.json';sources.append({'name':folder,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 for f in json.loads(p.read_text()):
  if f['status']!='ok':continue
  d=f['date'];day=days.setdefault(d,{'date':d,'futures':{},'quotes':{}})
  if f['kind']=='index':
   n=next(x for x in f['rows']if x['Index Name']=='Nifty 50');v=next((x for x in f['rows']if x['Index Name']=='India VIX'),None)
   for key,k in [('spot','Closing Index Value'),('open','Open Index Value'),('high','High Index Value'),('low','Low Index Value')]:
    z=float(n[k]);assert key not in day or day[key]==z;day[key]=z
   if v:day['vix']=float(v['Closing Index Value'])
  else:
   for x in f['rows']:
    if x['SYMBOL']!='NIFTY':continue
    exp=dt.datetime.strptime(x['EXPIRY_DT'],'%d-%b-%Y').date().isoformat()
    if x['INSTRUMENT']=='FUTIDX':day['futures'][exp]=float(x['CLOSE']);continue
    if x['INSTRUMENT']!='OPTIDX':continue
    k=int(float(x['STRIKE_PR']));t=x['OPTION_TYP'];key=f'{exp}|{k}|{t}';lot=int(x.get('LOT_SIZE')or(50 if d<'2024-04-26' else 25))
    q=[exp,k,t,float(x['OPEN']),float(x['CLOSE']),int(x['CONTRACTS']),int(x['OPEN_INT']),lot]
    assert key not in day['quotes']or day['quotes'][key]==q,(d,key)
    day['quotes'][key]=q
with zipfile.ZipFile(ROOT/'august2024-asof/normalized15JUL2024.zip')as z:rows=list(csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode())))
day=days['2024-07-15']
for x in rows:
 exp=dt.datetime.strptime(x['EXPIRY_DT'],'%d-%b-%Y').date().isoformat()
 if x['INSTRUMENT']=='FUTIDX':day['futures'][exp]=float(x['CLOSE'])
 else:
  k=int(float(x['STRIKE_PR']));t=x['OPTION_TYP'];day['quotes'][f'{exp}|{k}|{t}']=[exp,k,t,float(x['OPEN']),float(x['CLOSE']),int(x['CONTRACTS']),int(x['OPEN_INT']),25]
macro=[]
for l in (ROOT/'evidence/audit-c1/daily-scores.jsonl').open():
 x=json.loads(l)
 if x['today']>='2017-10-01':macro.append([x['today'],x['pressure'],x['expansion'],x['volatility']])
for day in days.values():day['quotes']=list(day['quotes'].values())
meta={'version':'research-archive-1','macroVersion':'C1-37.9.14-retrospective','description':'Archived C1 outputs; retrospective model, not historical published forecasts. NSE daily-price execution proxies.','marketRange':[min(days),max(days)],'macroRange':[macro[0][0],macro[-1][0]],'sources':sources,'exposedQuarters':['2023-Q3','2024-Q1','2024-Q2','2024-Q3'],'coverage':[{'start':'2023-08-14','end':'2023-09-28'},{'start':'2024-03-15','end':'2024-08-22'}],'quoteColumns':['expiry','strike','type','open','close','volume','oi','lot'],'historySources':[{'title':'NSE: Nifty options commenced June 4, 2001','url':'https://nsearchives.nseindia.com/content/press/04062001.pdf'}]}
archive={'meta':meta,'macro':macro,'days':[days[d]for d in sorted(days)]};(DEST/'archive.json').write_text(json.dumps(archive,separators=(',',':')))
studies=[]
for folder,title,period in [('sept2023-timing','September 2023 · timing','2023-Q3'),('april2024-reveal','April 2024 · calls & puts','2024-Q2'),('may2024-reveal','May 2024 · expansion miss','2024-Q2'),('june2024-reveal','June 2024 · pressure waves','2024-Q2'),('july2024-reveal','July 2024 · early vs late','2024-Q3'),('august-entry-comparison','August 2024 · three puts','2024-Q3')]:
 d=json.loads((ROOT/folder/'results.json').read_text());studies.append({'id':folder,'title':title,'quarter':period,'exposure':'Previously examined development study','sourceHash':hashlib.sha256((ROOT/folder/'results.json').read_bytes()).hexdigest(),'selections':d.get('selections',[]),'results':d['results'],'protocolHashes':{k:v for k,v in d.items()if k.endswith('SHA256')}})
(DEST/'studies.json').write_text(json.dumps(studies,separators=(',',':')))
print({'days':len(days),'quotes':sum(len(x['quotes'])for x in days.values()),'macroDays':len(macro),'archiveBytes':(DEST/'archive.json').stat().st_size,'studyRows':sum(len(x['results'])for x in studies)})
