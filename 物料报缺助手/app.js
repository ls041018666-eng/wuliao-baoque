(() => {
'use strict';
const K={m:'wms_shortage_materials_v2',s:'wms_shortage_settings_v2',h:'wms_shortage_history_v2'};
const $=id=>document.getElementById(id);
const sample=[
 {code:'WL-10001',name:'六角螺栓',spec:'M8×30',unit:'个'},
 {code:'WL-10002',name:'六角螺母',spec:'M8',unit:'个'},
 {code:'WL-10003',name:'平垫圈',spec:'Φ8',unit:'个'},
 {code:'WL-20001',name:'缠绕膜',spec:'50cm×300m',unit:'卷'},
 {code:'WL-20002',name:'纸箱',spec:'600×400×350mm',unit:'个'},
 {code:'WL-20003',name:'封箱胶带',spec:'透明 60mm',unit:'卷'},
 {code:'WL-30001',name:'防护手套',spec:'耐磨型',unit:'双'},
 {code:'WL-30002',name:'标签纸',spec:'100×70mm',unit:'卷'}
].map(x=>({id:uid(),...x}));
let materials=load(K.m,null); if(!Array.isArray(materials)){materials=sample;save(K.m,materials)}
let shortages=[],history=load(K.h,[]),settings=load(K.s,{}),unitFilter='',installPrompt=null;
const el={
 search:$('searchInput'),materialList:$('materialList'),materialSummary:$('materialSummary'),chips:$('unitChips'),
 shortageList:$('shortageList'),heroCount:$('heroCount'),barCount:$('barCount'),date:$('reportDate'),shift:$('shift'),warehouse:$('warehouse'),reporter:$('reporter'),note:$('extraNote'),
 preview:$('preview'),chars:$('charCount'),history:$('historyList'),manage:$('manageList'),manageSearch:$('manageSearch'),toast:$('toast')
};
init();
function init(){
 const d=today();el.date.value=d; $('todayText').textContent=formatDate(d);
 el.shift.value=settings.shift||'白班';el.warehouse.value=settings.warehouse||'';el.reporter.value=settings.reporter||'';el.note.value=settings.note||'';
 bind();renderAll();registerSW();
}
function bind(){
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));
 el.search.addEventListener('input',renderMaterials);el.manageSearch.addEventListener('input',renderManage);
 $('addMaterialBtn').addEventListener('click',()=>openMaterial());$('importBtn').addEventListener('click',()=>{renderManage();openModal('manageModal')});
 $('settingsBtn').addEventListener('click',()=>openModal('settingsModal'));
 $('saveMaterialBtn').addEventListener('click',saveMaterial);$('doImportBtn').addEventListener('click',doImport);
 $('fileBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',readFile);
 $('exportBtn').addEventListener('click',exportCsv);$('deleteAllBtn').addEventListener('click',deleteAll);
 $('clearBtn').addEventListener('click',clearCurrent);$('copyBtn').addEventListener('click',()=>copy(buildReport()));
 $('shareBtn').addEventListener('click',share);$('saveHistoryBtn').addEventListener('click',saveHistory);
 $('clearHistoryBtn').addEventListener('click',clearHistory);$('installBtn').addEventListener('click',installApp);
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
 document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
 [el.date,el.shift,el.warehouse,el.reporter,el.note].forEach(x=>{x.addEventListener('input',()=>{saveSettings();renderPreview()});x.addEventListener('change',()=>{saveSettings();renderPreview()})});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').disabled=false});
 window.addEventListener('appinstalled',()=>{installPrompt=null;toast('已安装到手机桌面')});
}
function renderAll(){renderChips();renderMaterials();renderShortages();renderPreview();renderHistory()}
function showView(name){
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===name+'View'));
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 window.scrollTo({top:0,behavior:'smooth'});
}
function renderChips(){
 const units=[...new Set(materials.map(x=>x.unit).filter(Boolean))];el.chips.innerHTML='';
 [['','全部'],...units.map(x=>[x,x])].forEach(([val,label])=>{const b=document.createElement('button');b.className='chip'+(unitFilter===val?' active':'');b.textContent=label;b.onclick=()=>{unitFilter=val;renderChips();renderMaterials()};el.chips.appendChild(b)});
}
function renderMaterials(){
 const q=norm(el.search.value);const list=materials.filter(m=>(!q||norm(m.code+' '+m.name+' '+m.spec).includes(q))&&(!unitFilter||m.unit===unitFilter));
 el.materialSummary.textContent='共 '+materials.length+' 项，当前显示 '+list.length+' 项';el.materialList.innerHTML='';
 if(!list.length){el.materialList.appendChild(empty(materials.length?'没有匹配的物料':'物料库为空',materials.length?'换个关键词试试':'请新增或导入物料'));return}
 list.slice(0,400).forEach(m=>{const selected=shortages.some(s=>s.materialId===m.id),card=document.createElement('div');card.className='material-card';card.innerHTML='<div><div class="material-code">'+esc(m.code)+'</div><div class="material-name">'+esc(m.name)+'</div><div class="material-meta">'+esc(m.spec||'无规格')+' · '+esc(m.unit||'未设单位')+'</div></div><button class="select-btn '+(selected?'selected':'')+'" '+(selected?'disabled':'')+'>'+(selected?'已选':'＋ 选择')+'</button>';card.querySelector('button').onclick=()=>addShortage(m.id);el.materialList.appendChild(card)});
}
function addShortage(id){if(shortages.some(s=>s.materialId===id))return;shortages.push({materialId:id,qty:'',urgency:'一般',remark:''});renderShortages();renderMaterials();renderPreview();toast('已加入报缺明细')}
function renderShortages(){
 const n=shortages.length;el.heroCount.textContent=n;el.barCount.textContent=n;el.barCount.style.display=n?'block':'none';el.shortageList.innerHTML='';
 if(!n){el.shortageList.appendChild(empty('还没有缺料物料','回到“选物料”添加'));return}
 shortages.forEach((s,i)=>{const m=materials.find(x=>x.id===s.materialId);if(!m)return;const card=document.createElement('div');card.className='shortage-card';card.innerHTML='<div class="shortage-title"><div><strong>'+(i+1)+'. '+esc(m.name)+'</strong><code>'+esc(m.code)+' · '+esc(m.spec||'无规格')+' · '+esc(m.unit||'未设单位')+'</code></div><button class="remove">×</button></div><div class="shortage-fields"><input class="qty" inputmode="decimal" placeholder="缺口数量" value="'+attr(s.qty)+'"><select class="urg"><option '+(s.urgency==='一般'?'selected':'')+'>一般</option><option '+(s.urgency==='紧急'?'selected':'')+'>紧急</option><option '+(s.urgency==='停线急需'?'selected':'')+'>停线急需</option></select><input class="remark" placeholder="备注（可选）" value="'+attr(s.remark)+'"></div>';
 card.querySelector('.remove').onclick=()=>{shortages.splice(i,1);renderShortages();renderMaterials();renderPreview()};card.querySelector('.qty').oninput=e=>{s.qty=e.target.value;renderPreview()};card.querySelector('.urg').onchange=e=>{s.urgency=e.target.value;renderPreview()};card.querySelector('.remark').oninput=e=>{s.remark=e.target.value;renderPreview()};el.shortageList.appendChild(card)});
}
function buildReport(){
 const lines=['【物料报缺】'+(el.date.value||today())];
 if(el.warehouse.value.trim())lines.push('仓库/区域：'+el.warehouse.value.trim());
 if(el.shift.value)lines.push('班次：'+el.shift.value);
 if(el.reporter.value.trim())lines.push('报缺人：'+el.reporter.value.trim());
 lines.push('','报缺明细：');
 if(!shortages.length)lines.push('（请先选择缺料物料）');
 else{
  shortages.forEach((s,i)=>{
   const m=materials.find(x=>x.id===s.materialId);if(!m)return;
   const spec=m.spec?'｜'+m.spec:'';
   const qty=s.qty.trim()?s.qty.trim()+(m.unit||''):'待确认'+(m.unit?'（'+m.unit+'）':'');
   const urg=s.urgency!=='一般'?'｜【'+s.urgency+'】':'';
   const rem=s.remark.trim()?'｜备注：'+s.remark.trim():'';
   lines.push((i+1)+'. '+m.code+'｜'+m.name+spec+'｜缺口：'+qty+urg+rem);
  });
  lines.push('','共 '+shortages.length+' 项，请协助确认并安排补料。');
 }
 if(el.note.value.trim())lines.push('说明：'+el.note.value.trim());
 return lines.join('\n');
}
function renderPreview(){const t=buildReport();el.preview.textContent=t;el.chars.textContent=t.length+' 字'}
function openMaterial(m){$('materialModalTitle').textContent=m?'编辑物料':'新增物料';$('editId').value=m?.id||'';$('materialCode').value=m?.code||'';$('materialName').value=m?.name||'';$('materialSpec').value=m?.spec||'';$('materialUnit').value=m?.unit||'';openModal('materialModal');setTimeout(()=>$('materialCode').focus(),150)}
function saveMaterial(){
 const id=$('editId').value,code=$('materialCode').value.trim(),name=$('materialName').value.trim(),spec=$('materialSpec').value.trim(),unit=$('materialUnit').value.trim();if(!code||!name)return toast('请填写物料编码和名称');if(materials.some(m=>norm(m.code)===norm(code)&&m.id!==id))return toast('这个物料编码已经存在');
 if(id){const m=materials.find(x=>x.id===id);if(m)Object.assign(m,{code,name,spec,unit})}else materials.unshift({id:uid(),code,name,spec,unit});persist();closeModal('materialModal');renderAll();renderManage();toast(id?'物料已更新':'物料已新增')
}
function renderManage(){
 const q=norm(el.manageSearch.value),list=materials.filter(m=>!q||norm(m.code+m.name+m.spec).includes(q));el.manage.innerHTML='';if(!list.length){el.manage.appendChild(empty('没有物料','可在上方粘贴导入'));return}
 list.forEach(m=>{const row=document.createElement('div');row.className='manage-row';row.innerHTML='<div><b>'+esc(m.code)+' · '+esc(m.name)+'</b><small>'+esc(m.spec||'无规格')+' / '+esc(m.unit||'未设单位')+'</small></div><div><button class="edit">编辑</button><button class="del">删除</button></div>';row.querySelector('.edit').onclick=()=>openMaterial(m);row.querySelector('.del').onclick=()=>deleteMaterial(m);el.manage.appendChild(row)})
}
function deleteMaterial(m){if(!confirm('确定删除“'+m.name+'（'+m.code+'）”吗？'))return;materials=materials.filter(x=>x.id!==m.id);shortages=shortages.filter(x=>x.materialId!==m.id);persist();renderAll();renderManage();toast('物料已删除')}
function deleteAll(){if(!materials.length)return;if(!confirm('确定删除全部 '+materials.length+' 项物料吗？建议先导出备份。'))return;materials=[];shortages=[];persist();renderAll();renderManage();toast('物料库已清空')}
function doImport(){const text=$('importText').value.trim();if(!text)return toast('请粘贴 Excel 表格内容');const result=importRows(parse(text));if(!result.total)return toast('没有识别到编码和名称，请检查列顺序');$('importText').value='';persist();renderAll();renderManage();toast('导入完成：新增 '+result.added+'，更新 '+result.updated)}
function parse(text){
 const line=text.split(/\r?\n/)[0]||'';
 const del=line.includes('\t')?'\t':(line.includes(',')?',':'，');
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(c===del&&!quoted){row.push(cell.trim());cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';
  }else cell+=c;
 }
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
}
function importRows(rows){if(!rows.length)return{total:0,added:0,updated:0};const h=rows[0].map(norm),isHead=h.some(x=>/编码|料号|名称|品名|规格|单位/.test(x));let start=isHead?1:0,map={code:0,name:1,spec:2,unit:3};if(isHead){map.code=find(h,['物料编码','编码','物料号','料号','code']);map.name=find(h,['物料名称','名称','品名','name']);map.spec=find(h,['规格型号','规格','型号','spec']);map.unit=find(h,['单位','unit'])}if(map.code<0||map.name<0)return{total:0,added:0,updated:0};let added=0,updated=0;for(let i=start;i<rows.length;i++){const r=rows[i],code=String(r[map.code]||'').trim(),name=String(r[map.name]||'').trim();if(!code||!name)continue;const data={code,name,spec:map.spec>=0?String(r[map.spec]||'').trim():'',unit:map.unit>=0?String(r[map.unit]||'').trim():''},old=materials.find(m=>norm(m.code)===norm(code));if(old){Object.assign(old,data);updated++}else{materials.push({id:uid(),...data});added++}}return{total:added+updated,added,updated}}
function find(h,names){return h.findIndex(x=>names.some(n=>x===norm(n)||x.includes(norm(n))))}
async function readFile(e){const f=e.target.files[0];if(!f)return;try{const b=await f.arrayBuffer();let t=new TextDecoder('utf-8').decode(b);if((t.match(/�/g)||[]).length>2)try{t=new TextDecoder('gb18030').decode(b)}catch{}$('importText').value=t;toast('已读取 '+f.name)}catch{toast('文件读取失败，请复制粘贴')}e.target.value=''}
function exportCsv(){
 if(!materials.length)return toast('物料库为空');
 const rows=[['物料编码','物料名称','规格型号','单位'],...materials.map(m=>[m.code,m.name,m.spec,m.unit])];
 const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 download(csv,'物料清单备份_'+today()+'.csv','text/csv;charset=utf-8');toast('备份已导出');
}
function saveHistory(){if(!shortages.length)return toast('请先选择报缺物料');history.unshift({id:uid(),date:el.date.value||today(),warehouse:el.warehouse.value.trim(),reporter:el.reporter.value.trim(),text:buildReport(),items:shortages.map(x=>({...x}))});history=history.slice(0,40);save(K.h,history);renderHistory();toast('本次报缺已保存')}
function renderHistory(){el.history.innerHTML='';if(!history.length){el.history.appendChild(empty('暂无历史记录','保存后可快速再次使用'));return}history.forEach(h=>{const c=document.createElement('div');c.className='history-card';c.innerHTML='<div class="history-top"><b>'+esc(h.date)+' '+esc(h.warehouse||'')+'</b><span class="pill">'+(h.items?.length||0)+' 项</span></div><p>'+(h.reporter?'报缺人：'+esc(h.reporter):'未填写报缺人')+'</p><div class="history-actions"><button class="copy">复制</button><button class="reuse">再次使用</button><button class="del">删除</button></div>';c.querySelector('.copy').onclick=()=>copy(h.text);c.querySelector('.reuse').onclick=()=>{shortages=(h.items||[]).filter(s=>materials.some(m=>m.id===s.materialId)).map(s=>({...s}));el.date.value=today();renderAll();showView('fill');toast('已载入 '+shortages.length+' 项物料')};c.querySelector('.del').onclick=()=>{history=history.filter(x=>x.id!==h.id);save(K.h,history);renderHistory()};el.history.appendChild(c)})}
function clearHistory(){if(!history.length)return;if(!confirm('确定清空全部历史记录吗？'))return;history=[];save(K.h,history);renderHistory();toast('历史记录已清空')}
function clearCurrent(){if(!shortages.length)return;if(!confirm('确定清空当前报缺明细吗？'))return;shortages=[];renderAll()}
async function copy(t){try{await navigator.clipboard.writeText(t);toast('已复制，可直接粘贴到微信群')}catch{const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('已复制，可直接粘贴到微信群')}}
async function share(){const t=buildReport();if(navigator.share)try{await navigator.share({title:'物料报缺',text:t})}catch(e){if(e.name!=='AbortError')copy(t)}else copy(t)}
async function installApp(){if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else toast('请用浏览器菜单选择“添加到主屏幕”')}
function saveSettings(){settings={shift:el.shift.value,warehouse:el.warehouse.value,reporter:el.reporter.value,note:el.note.value};save(K.s,settings)}
function registerSW(){if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{})}
function openModal(id){$(id).classList.add('show');document.body.style.overflow='hidden'}function closeModal(id){$(id).classList.remove('show');if(!document.querySelector('.modal.show'))document.body.style.overflow=''}
function persist(){save(K.m,materials)}function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}}function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function today(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}function formatDate(s){const [y,m,d]=s.split('-');return y+'年'+Number(m)+'月'+Number(d)+'日'}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,'')}function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}function attr(v){return esc(v).replace(/`/g,'&#96;')}
function empty(a,b){const d=document.createElement('div');d.className='empty';d.innerHTML='<b>'+esc(a)+'</b><span>'+esc(b)+'</span>';return d}
function download(c,n,t){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
let toastTimer;function toast(t){el.toast.textContent=t;el.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2400)}
})();