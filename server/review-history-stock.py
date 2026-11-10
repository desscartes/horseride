"""Local editorial review for existing motion-library gates; no network, secrets or Codex."""
from pathlib import Path
import json,hashlib,datetime,os,re

APP=Path('D:/Apps/HorseRide');BASE=APP/'data/instagram/native-renderer';EPISODES=BASE/'episodes'
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def validate_library(directory,library,ledger):
 directory=Path(directory).resolve();clips=library.get('clips',{})
 if len(clips)<4:raise ValueError('En az dört farklı sahne gerekli.')
 used={a for e in ledger.get('episodes',[]) if e.get('episode')!=directory.name for a in e.get('assets',[])}
 seen=set();paths={}
 for role,c in clips.items():
  if not c.get('sourceId') or not c.get('sha256'):raise ValueError('Sahne kaynak kimliği veya hash eksik.')
  p=(directory/c['file']).resolve();p.relative_to(directory)
  if digest(p)!=c['sha256']:raise ValueError('Sahne dosyası değişmiş; yeniden incelenmeli.')
  ids={c['sourceId'],c['sha256']}
  if ids&used:raise ValueError('Daha önce yayımlanmış görüntü yeniden kullanılamaz.')
  if ids&seen:raise ValueError('Aynı görüntü iki sahneye yerleştirilemez.')
  seen.update(ids);paths[role]=p
 return paths

def main():
 import tkinter as tk
 from tkinter import ttk,messagebox
 root=tk.Tk();root.title('Ganyan Zekâsı — tarih videosu stok incelemesi');root.geometry('850x590')
 state={}
 ttk.Label(root,text='Hazır sahneleri izleyip mevcut kalite kontrolünü burada tamamlayabilirsin.',wraplength=800).pack(padx=18,pady=12,anchor='w')
 ttk.Label(root,text='Onay sonrası uygun tarih ve bülten koşulları sağlanırsa planlı yayıncı devam eder.',wraplength=800).pack(padx=18,anchor='w')
 episodes=ttk.Combobox(root,state='readonly',width=90);episodes.pack(padx=18,pady=12)
 scenes=tk.Listbox(root,height=10,exportselection=False);scenes.pack(padx=18,fill='x')
 info=tk.Text(root,height=7,wrap='word');info.pack(padx=18,pady=10,fill='x')
 status=tk.StringVar(value='');ttk.Label(root,textvariable=status,wraplength=810).pack(padx=18,anchor='w')
 def load(*unused):
  state.clear();scenes.delete(0,'end');info.delete('1.0','end')
  try:
   identifier=episodes.get()
   if not re.fullmatch('[a-z0-9-]{1,90}',identifier):return
   directory=EPISODES/identifier;path=directory/'motion-library.json';library=read(path)
   ledger=read(BASE/'motion-use-ledger.json') if (BASE/'motion-use-ledger.json').exists() else {'episodes':[]}
   paths=validate_library(directory,library,ledger)
   state.update(directory=directory,path=path,snapshot=digest(path),library=library,paths=paths,opened=set())
   for role in paths:scenes.insert('end',role)
   info.insert('end',library.get('disclosure','')+'\n\n'+library.get('credits',''))
   status.set('Her sahneyi açıp baştan sona izle. Bozuk anatomi, bulanık yüz, yanlış olay/tarih ve tekrarlanan görüntü varsa onaylama.')
  except Exception as e:status.set('İnceleme açılamadı: '+str(e))
 def refresh():
  entries=sorted(d.name for d in EPISODES.glob('*') if d.is_dir() and (d/'motion-library.json').is_file() and read(d/'motion-library.json').get('reviewed') is not True)
  episodes['values']=entries
  if entries:episodes.set(entries[0]);load()
  else:episodes.set('');status.set('Henüz incelenmeyi bekleyen tamamlanmış sahne paketi yok. Üretim sürüyor olabilir.')
 def watch():
  selected=scenes.curselection()
  if not selected or not state:return
  role=scenes.get(selected[0]);os.startfile(str(state['paths'][role]));state['opened'].add(role)
 def approve():
  try:
   if not state or state['opened']!=set(state['paths']):raise ValueError('Önce bütün sahneleri açıp izle.')
   if digest(state['path'])!=state['snapshot']:raise ValueError('Paket inceleme sırasında değişti. Yenile ve tekrar izle.')
   ledger=read(BASE/'motion-use-ledger.json') if (BASE/'motion-use-ledger.json').exists() else {'episodes':[]}
   library=read(state['path']);validate_library(state['directory'],library,ledger)
   if not messagebox.askyesno('Görsel inceleme','Tüm sahneleri izledin ve görüntü, kaynak/tarih, anatomi ve tekrar kontrollerini uygun buldun mu? Onay, mevcut otomatik yayın akışını açar.'):return
   library.update(reviewed=True,review={'by':'local_operator','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'all_scenes_opened_and_operator_confirmed'})
   temp=state['path'].with_suffix('.review.tmp');temp.write_text(json.dumps(library,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(state['path'])
   status.set('İnceleme kaydedildi. Yayımlandığı anlamına gelmez; yayıncı kaynak, tarih ve tekrar kontrollerini ayrıca yapar.');refresh()
  except Exception as e:messagebox.showerror('Onay kaydedilmedi',str(e))
 buttons=ttk.Frame(root);buttons.pack(padx=18,pady=12,fill='x')
 ttk.Button(buttons,text='Paketleri yenile',command=refresh).pack(side='left')
 ttk.Button(buttons,text='Seçili sahneyi izle',command=watch).pack(side='left',padx=10)
 ttk.Button(buttons,text='İncelenen paketi onayla',command=approve).pack(side='right')
 episodes.bind('<<ComboboxSelected>>',load);scenes.bind('<Double-Button-1>',lambda e:watch());refresh();root.mainloop()
if __name__=='__main__':main()
