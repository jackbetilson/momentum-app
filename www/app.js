const STORAGE_KEY='momentum-state-v1';
const defaultState={tasks:[],history:[],focusMinutes:0,lastDoneDate:null,streak:0,theme:'light',activeTaskId:null,timer:{remaining:1500,total:1500,running:false,lastTick:null}};
let state=loadState();
let timerHandle=null;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const taskForm=$('#taskForm');
const taskInput=$('#taskInput');
const minutesInput=$('#minutesInput');
const taskList=$('#taskList');
const taskCounter=$('#taskCounter');
const activeTaskName=$('#activeTaskName');
const activeTaskMeta=$('#activeTaskMeta');
const timeDisplay=$('#timeDisplay');
const timerState=$('#timerState');
const startPauseBtn=$('#startPauseBtn');
const resetBtn=$('#resetBtn');
const finishBtn=$('#finishBtn');

function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return raw?{...defaultState,...raw,timer:{...defaultState.timer,...raw.timer}}:structuredClone(defaultState);
  }catch{return structuredClone(defaultState)}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function dateKey(d=new Date()){return d.toISOString().slice(0,10)}
function formatTime(sec){sec=Math.max(0,Math.floor(sec));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function setPage(id){$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===id))}

$$('.tab').forEach(tab=>tab.addEventListener('click',()=>setPage(tab.dataset.page)));
$('#themeBtn').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();saveState()});
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark');document.querySelector('meta[name="theme-color"]').content=state.theme==='dark'?'#0c1019':'#eef1f6'}

taskForm.addEventListener('submit',e=>{
  e.preventDefault();
  const title=taskInput.value.trim();
  const minutes=Math.max(1,Math.min(240,Number(minutesInput.value)||25));
  if(!title)return;
  state.tasks.unshift({id:uid(),title,minutes,done:false,createdAt:Date.now(),completedAt:null});
  taskInput.value='';
  saveState();render();toast('Tarefa adicionada');
});

taskList.addEventListener('click',e=>{
  const item=e.target.closest('.task-item');if(!item)return;
  const task=state.tasks.find(t=>t.id===item.dataset.id);if(!task)return;
  if(e.target.closest('.task-check'))toggleTask(task);
  if(e.target.closest('.focus'))selectTask(task);
  if(e.target.closest('.delete'))deleteTask(task);
});

function toggleTask(task){
  task.done=!task.done;task.completedAt=task.done?Date.now():null;
  if(task.done){updateStreak();toast('Boa! Tarefa concluída')}
  saveState();render();
}
function deleteTask(task){
  state.tasks=state.tasks.filter(t=>t.id!==task.id);
  if(state.activeTaskId===task.id){state.activeTaskId=null;pauseTimer();state.timer={...defaultState.timer}}
  saveState();render();
}
function selectTask(task){
  state.activeTaskId=task.id;
  state.timer={remaining:task.minutes*60,total:task.minutes*60,running:false,lastTick:null};
  saveState();render();setPage('focus');
}

startPauseBtn.addEventListener('click',()=>{
  if(!state.activeTaskId)return;
  if(state.timer.running)pauseTimer();else startTimer();
  saveState();renderTimer();
});
resetBtn.addEventListener('click',()=>{
  const task=getActiveTask();if(!task)return;
  pauseTimer();state.timer.remaining=task.minutes*60;state.timer.total=task.minutes*60;saveState();renderTimer();
});
finishBtn.addEventListener('click',()=>finishSession(false));

function startTimer(){
  state.timer.running=true;state.timer.lastTick=Date.now();
  clearInterval(timerHandle);timerHandle=setInterval(tick,1000);
}
function pauseTimer(){
  if(state.timer.running)syncElapsed();
  state.timer.running=false;state.timer.lastTick=null;clearInterval(timerHandle);timerHandle=null;
}
function syncElapsed(){
  if(!state.timer.running||!state.timer.lastTick)return;
  const elapsed=Math.floor((Date.now()-state.timer.lastTick)/1000);
  if(elapsed>0){state.timer.remaining=Math.max(0,state.timer.remaining-elapsed);state.timer.lastTick=Date.now()}
}
function tick(){
  syncElapsed();
  if(state.timer.remaining<=0){finishSession(true);return}
  saveState();renderTimer();
}
function finishSession(auto){
  const task=getActiveTask();if(!task)return;
  pauseTimer();
  const completedSeconds=Math.max(0,state.timer.total-state.timer.remaining);
  const credited=Math.max(1,Math.round(completedSeconds/60));
  state.focusMinutes+=credited;
  state.history.unshift({id:uid(),task:task.title,minutes:credited,date:Date.now()});
  state.history=state.history.slice(0,50);
  if(auto||state.timer.remaining===0){task.done=true;task.completedAt=Date.now();updateStreak()}
  state.activeTaskId=null;state.timer={...defaultState.timer};
  saveState();render();toast(auto?'Sessão terminada!':'Sessão guardada');
}
function getActiveTask(){return state.tasks.find(t=>t.id===state.activeTaskId)||null}
function updateStreak(){
  const today=dateKey();
  if(state.lastDoneDate===today)return;
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  state.streak=state.lastDoneDate===dateKey(yesterday)?state.streak+1:1;
  state.lastDoneDate=today;
}

$('#clearHistoryBtn').addEventListener('click',()=>{state.history=[];saveState();renderProgress();toast('Histórico limpo')});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.timer.running){syncElapsed();if(state.timer.remaining<=0)finishSession(true);else{saveState();renderTimer()}}});

function renderTasks(){
  const open=state.tasks.filter(t=>!t.done).length;taskCounter.textContent=`${open} ${open===1?'aberta':'abertas'}`;
  if(!state.tasks.length){taskList.innerHTML='<div class="empty-state">Ainda não tens tarefas. Adiciona a primeira acima.</div>';return}
  taskList.innerHTML=state.tasks.map(t=>`<div class="task-item ${t.done?'done':''}" data-id="${t.id}">
    <button class="task-check" aria-label="${t.done?'Reabrir':'Concluir'} tarefa">${t.done?'✓':''}</button>
    <div><span class="task-title">${escapeHtml(t.title)}</span><span class="task-meta">${t.minutes} minutos</span></div>
    <div class="task-buttons"><button class="mini-btn focus">Focar</button><button class="mini-btn delete">Eliminar</button></div>
  </div>`).join('');
}
function renderTimer(){
  const task=getActiveTask();
  activeTaskName.textContent=task?task.title:'Escolhe uma tarefa';
  activeTaskMeta.textContent=task?`${task.minutes} minutos planeados`:'O temporizador ficará ligado à tarefa selecionada.';
  timeDisplay.textContent=formatTime(state.timer.remaining);
  timerState.textContent=state.timer.running?'Em foco':task?'Pronto':'Sem tarefa';
  startPauseBtn.disabled=!task;resetBtn.disabled=!task;finishBtn.disabled=!task;
  startPauseBtn.textContent=state.timer.running?'Pausar':'Iniciar';
}
function renderProgress(){
  $('#doneStat').textContent=state.tasks.filter(t=>t.done).length;
  $('#focusStat').textContent=state.focusMinutes;
  $('#streakStat').textContent=state.streak;
  const list=$('#historyList');
  if(!state.history.length){list.innerHTML='<div class="empty-state">As sessões concluídas aparecerão aqui.</div>';return}
  list.innerHTML=state.history.map(h=>`<div class="history-item"><div><strong>${escapeHtml(h.task)}</strong><span>${new Date(h.date).toLocaleString('pt-PT')}</span></div><strong>${h.minutes} min</strong></div>`).join('');
}
function render(){renderTasks();renderTimer();renderProgress()}

applyTheme();
if(state.timer.running){syncElapsed();if(state.timer.remaining<=0)finishSession(true);else startTimer()}
render();
