import { getRawDb } from "../../../db";
const json=(data:unknown,status=200)=>Response.json(data,{status});
const id=()=>crypto.randomUUID();
async function readBody(r:Request){try{return await r.json() as Record<string,unknown>}catch{return {}}}
async function finishRound(db:D1Database,room:any,question:any){
  const locked=await db.prepare("UPDATE rooms SET status='results' WHERE id=? AND status='question'").bind(room.id).run();
  if(Number(locked.meta.changes||0)>0) await db.prepare("UPDATE players SET score=score+COALESCE((SELECT points FROM answers WHERE answers.player_id=players.id AND answers.question_id=?),0) WHERE room_id=?").bind(question.id,room.id).run();
}
export async function GET(request:Request){
 try{
  const db=getRawDb(),u=new URL(request.url),roomCode=(u.searchParams.get("code")||"").replace(/\D/g,"");
  let room=await db.prepare("SELECT * FROM rooms WHERE code=?").bind(roomCode).first<Record<string,any>>();
  if(!room)return json({error:"Oda bulunamadı."},404);
  const qs=(await db.prepare("SELECT id,position,prompt,options_json,seconds,correct_index FROM questions WHERE quiz_id=? ORDER BY position").bind(room.quiz_id).all<Record<string,any>>()).results;
  const qi=Number(room.current_question),q=qi>=0?qs[qi]:null;
  let answered=q?Number((await db.prepare("SELECT COUNT(*) n FROM answers WHERE room_id=? AND question_id=?").bind(room.id,q.id).first<Record<string,any>>())?.n||0):0;
  const playerCount=Number((await db.prepare("SELECT COUNT(*) n FROM players WHERE room_id=?").bind(room.id).first<Record<string,any>>())?.n||0);
  if(room.status==="question"&&q&&(answered>=playerCount&&playerCount>0||Date.now()>=Number(room.question_started_at)+Number(q.seconds)*1000)){
    await finishRound(db,room,q);room={...room,status:"results"};
  }
  const players=(await db.prepare("SELECT id,name,score FROM players WHERE room_id=? ORDER BY score DESC,joined_at ASC").bind(room.id).all<Record<string,any>>()).results;
  const token=u.searchParams.get("playerToken"),host=u.searchParams.get("hostToken")===room.host_token;let player=null,hasAnswered=false;
  if(token){player=await db.prepare("SELECT id,name,score FROM players WHERE room_id=? AND token=?").bind(room.id,token).first<Record<string,any>>();if(player&&q)hasAnswered=!!(await db.prepare("SELECT 1 FROM answers WHERE player_id=? AND question_id=?").bind(player.id,q.id).first())}
  return json({room:{code:room.code,status:room.status,currentQuestion:qi,questionStartedAt:room.question_started_at,totalQuestions:qs.length},question:q?{id:q.id,prompt:q.prompt,options:JSON.parse(q.options_json),seconds:q.seconds,...(room.status==="results"||room.status==="finished"||host?{correctIndex:q.correct_index}:{})}:null,players,player:player?{...player,score:room.status==="question"?null:player.score}:null,hasAnswered,answered,isHost:host});
 }catch(e){console.error(e);return json({error:"Oyun verileri yüklenemedi."},500)}
}
export async function POST(request:Request){
 try{
  const db=getRawDb(),p=await readBody(request),action=String(p.action||"");
  if(action==="create"){
   const title=String(p.title||"").trim(),items=Array.isArray(p.questions)?p.questions as any[]:[];
   if(!title||!items.length||items.some(q=>!String(q.prompt).trim()||!Array.isArray(q.options)||q.options.some((o:unknown)=>!String(o).trim())))return json({error:"Tüm soru ve seçenekleri doldur."},400);
   const quizId=id(),roomId=id(),hostToken=id(),roomCode=String(Math.floor(100000+Math.random()*900000)),now=Date.now();
   await db.batch([db.prepare("INSERT INTO quizzes(id,title,created_at) VALUES(?,?,?)").bind(quizId,title,now),...items.map((q,i)=>db.prepare("INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds) VALUES(?,?,?,?,?,?,?)").bind(id(),quizId,i,String(q.prompt).trim(),JSON.stringify(q.options),Number(q.correctIndex),Math.max(5,Math.min(120,Number(q.seconds)||20)))),db.prepare("INSERT INTO rooms(id,code,quiz_id,host_token,status,current_question,created_at) VALUES(?,?,?,?,?,?,?)").bind(roomId,roomCode,quizId,hostToken,"lobby",-1,now)]);
   return json({code:roomCode,hostToken},201);
  }
  const roomCode=String(p.code||"").replace(/\D/g,""),room=await db.prepare("SELECT * FROM rooms WHERE code=?").bind(roomCode).first<Record<string,any>>();
  if(!room)return json({error:"Oda bulunamadı."},404);
  if(action==="join"){
   if(room.status!=="lobby")return json({error:"Bu oyun başlamış."},409);const name=String(p.name||"").trim().slice(0,24);if(!name)return json({error:"Bir isim yaz."},400);
   const token=id();await db.prepare("INSERT INTO players(id,room_id,name,token,score,joined_at) VALUES(?,?,?,?,0,?)").bind(id(),room.id,name,token,Date.now()).run();return json({playerToken:token},201);
  }
  if(action==="advance"){
   if(String(p.hostToken)!==room.host_token)return json({error:"Yetkisiz işlem."},403);
   if(room.status==="question"){const q=await db.prepare("SELECT id FROM questions WHERE quiz_id=? AND position=?").bind(room.quiz_id,room.current_question).first();if(q)await finishRound(db,room,q);return json({ok:true})}
   const count=Number((await db.prepare("SELECT COUNT(*) n FROM questions WHERE quiz_id=?").bind(room.quiz_id).first<Record<string,any>>())?.n||0),next=Number(room.current_question)+1;
   if(next>=count)await db.prepare("UPDATE rooms SET status='finished' WHERE id=?").bind(room.id).run();else await db.prepare("UPDATE rooms SET status='question',current_question=?,question_started_at=? WHERE id=?").bind(next,Date.now(),room.id).run();return json({ok:true});
  }
  if(action==="answer"){
   if(room.status!=="question")return json({error:"Cevap süresi kapandı."},409);const player=await db.prepare("SELECT * FROM players WHERE room_id=? AND token=?").bind(room.id,String(p.playerToken)).first<Record<string,any>>();if(!player)return json({error:"Oyuncu bulunamadı."},403);
   const q=await db.prepare("SELECT * FROM questions WHERE quiz_id=? AND position=?").bind(room.quiz_id,room.current_question).first<Record<string,any>>();if(!q||Date.now()>=Number(room.question_started_at)+Number(q.seconds)*1000)return json({error:"Süre doldu."},409);
   const option=Number(p.optionIndex),correct=option===Number(q.correct_index),elapsed=Math.max(0,Date.now()-Number(room.question_started_at)),ratio=Math.max(0,1-elapsed/(Number(q.seconds)*1000)),points=correct?Math.round(500+500*ratio):0;
   try{await db.prepare("INSERT INTO answers(id,room_id,player_id,question_id,option_index,is_correct,points,answered_at) VALUES(?,?,?,?,?,?,?,?)").bind(id(),room.id,player.id,q.id,option,correct?1:0,points,Date.now()).run()}catch{return json({error:"Bu soruyu zaten cevapladın."},409)}
   return json({received:true});
  }
  return json({error:"Geçersiz işlem."},400);
 }catch(e){console.error(e);return json({error:"Sunucu işlemi tamamlayamadı."},500)}
}
