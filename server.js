import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
app.use(cors());
const __filename=fileURLToPath(import.meta.url),__dirname=path.dirname(__filename);
app.use(express.static(path.join(__dirname,'../frontend')));

const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});

app.post('/api/analyze',upload.single('image'),async(req,res)=>{
  try{
    if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'OPENAI_API_KEY সেট করা হয়নি।'});
    if(!req.file) return res.status(400).json({error:'Chart image পাওয়া যায়নি।'});
    const mime=req.file.mimetype;
    if(!mime.startsWith('image/')) return res.status(400).json({error:'শুধু image file গ্রহণ করা হয়।'});
    const dataUrl=`data:${mime};base64,${req.file.buffer.toString('base64')}`;
    const prompt=`You are a cautious trading-chart image analyst. Analyze ONLY what is visibly supported by the uploaded screenshot. Do not claim certainty or guaranteed profit. Do not invent exact prices if unreadable. Return ONLY valid JSON with these keys: direction (UP, DOWN, or WAIT), confidence (integer 0-100), trend (short Bangla string), candle_structure (short Bangla string), support (short Bangla string), resistance (short Bangla string), reason (short Bangla string). If the screenshot is not a recognizable trading chart or is too unclear, use direction WAIT and explain why. Treat UP/DOWN as an educational directional assessment, not a guaranteed prediction. Consider visible market structure, recent candle behavior, support/resistance and momentum.`;
    const response=await client.responses.create({
      model:'gpt-4.1-mini',
      input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl}]}],
      temperature:0.2
    });
    const raw=response.output_text?.trim()||'';
    const cleaned=raw.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let result;
    try{result=JSON.parse(cleaned)}catch{throw new Error('AI JSON response পাওয়া যায়নি।');}
    const allowed=['UP','DOWN','WAIT'];
    if(!allowed.includes(String(result.direction).toUpperCase())) result.direction='WAIT';
    result.confidence=Math.max(0,Math.min(100,Number(result.confidence)||0));
    res.json(result);
  }catch(e){console.error(e);res.status(500).json({error:e.message||'AI analysis failed'});}
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../frontend/index.html')));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`QX CHART AI PRO running on http://localhost:${port}`));
