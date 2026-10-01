import { getRawDb } from "../../../db";
const PASSWORD_HASH="79eceb95913939893f07bcc38a6fa2fdad0fb738899275667c1e530eaaa6263b";
const SESSION="7f5d4f2e8d27e2c41f7f9d99c99038eb510aa67c5acf62406d5c306b397da83b";
const json=(data:unknown,status=200,headers?:HeadersInit)=>Response.json(data,{status,headers});
const authed=(r:Request)=>(r.headers.get("cookie")||"").split(";").some(x=>x.trim()===`quizora_admin=${SESSION}`);
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function passwordHash(password:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode("quizora-admin-v1"),iterations:120000},key,256))}
async function payload(r:Request){try{return await r.json() as Record<string,any>}catch{return {}}}
async function listQuizzes(db:D1Database){const quizzes=(await db.prepare("SELECT id,title,created_at FROM quizzes ORDER BY created_at DESC").all<Record<string,any>>()).results;const questions=(await db.prepare("SELECT quiz_id,prompt,options_json,correct_index,seconds,max_points,position FROM questions ORDER BY position").all<Record<string,any>>()).results;return quizzes.map(q=>({...q,questions:questions.filter(x=>x.quiz_id===q.id).map(x=>({prompt:x.prompt,options:JSON.parse(x.options_json),correctIndex:x.correct_index,seconds:x.seconds,points:x.max_points}))}))}
export async function GET(request:Request){if(!authed(request))return json({authenticated:false},401);try{return json({authenticated:true,quizzes:await listQuizzes(getRawDb())})}catch(e){console.error(e);return json({error:"Kayıtlı yarışmalar yüklenemedi."},500)}}
export async function POST(request:Request){const p=await payload(request),action=String(p.action||"");
 if(action==="login"){if(String(p.username)!=="admin"||await passwordHash(String(p.password||""))!==PASSWORD_HASH)return json({error:"Kullanıcı adı veya şifre hatalı."},401);return json({authenticated:true},200,{"Set-Cookie":`quizora_admin=${SESSION}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`})}
 if(!authed(request))return json({error:"Yönetici oturumu gerekli."},401);
 try{const db=getRawDb();
  if(action==="save"){const title=String(p.title||"").trim(),items=Array.isArray(p.questions)?p.questions:[];if(!title||!items.length)return json({error:"Başlık ve soru gerekli."},400);const quizId=crypto.randomUUID(),now=Date.now();await db.batch([db.prepare("INSERT INTO quizzes(id,title,created_at) VALUES(?,?,?)").bind(quizId,title,now),...items.map((q:any,i:number)=>db.prepare("INSERT INTO questions(id,quiz_id,position,prompt,options_json,correct_index,seconds,max_points) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),quizId,i,String(q.prompt),JSON.stringify(q.options),Number(q.correctIndex),Number(q.seconds)||20,Number(q.points)||1000))]);return json({saved:true,quizzes:await listQuizzes(db)},201)}
  if(action==="start"){const quizId=String(p.quizId||""),exists=await db.prepare("SELECT id FROM quizzes WHERE id=?").bind(quizId).first();if(!exists)return json({error:"Yarışma bulunamadı."},404);const roomCode=String(Math.floor(100000+Math.random()*900000)),hostToken=crypto.randomUUID();await db.prepare("INSERT INTO rooms(id,code,quiz_id,host_token,status,current_question,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),roomCode,quizId,hostToken,"lobby",-1,Date.now()).run();return json({code:roomCode,hostToken},201)}
  return json({error:"Geçersiz işlem."},400)
 }catch(e){console.error(e);return json({error:"Yönetici işlemi tamamlanamadı."},500)}
}
