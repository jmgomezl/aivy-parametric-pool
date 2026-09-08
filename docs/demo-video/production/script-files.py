#!/usr/bin/env python3
"""Generate the readable script and draft caption cues from the single timeline."""
import json,pathlib,re,textwrap
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'timeline.json').read_text())
def clock(t,ms=False,comma=False):
 whole=int(t);fraction=round((t-whole)*1000)
 return (f'{whole//3600:02}:{whole//60%60:02}:{whole%60:02}'+(',' if comma else '.')+f'{fraction:03}') if ms else f'{whole//60}:{whole%60:02}'
md=['# Aivy Quorum · your narration script','',
 '**3:45 · English · around 110 words/minute, including pauses.**','',
 'Read this as if you were showing the app to one curious person. The delivery notes are not spoken. Make the wording your own. This is an AI-assisted draft shaped around your concept; it is not represented as an unaided human-written script. Record it in your own voice.','',
 'The video has no narration yet. [Open the rehearsal studio](https://quorum.aivylabs.xyz/demo-video/) to play it beside these cues.','']
plain=[];cues=[]
for c in data['chapters']:
 md.extend([f"## {clock(c['start'])}–{clock(c['end'])} · {c['title']}",'',f"*{c['direction']}*",'',c['script'],''])
 plain.extend([f"[{clock(c['start'])}–{clock(c['end'])}]",c['script'],''])
 # Meaningful sentence boundaries; split long sentences into short reading units.
 pieces=[]
 for sentence in re.split(r'(?<=[.!?])\s+',c['script']):
  words=sentence.split()
  while len(words)>13:
   pieces.append(' '.join(words[:10]));words=words[10:]
  if words:pieces.append(' '.join(words))
 weights=[len(x.split())+1 for x in pieces];total=sum(weights);time=c['start']
 for line,w in zip(pieces,weights):
  end=time+(c['end']-c['start'])*w/total
  cues.append((time,end,'\n'.join(textwrap.wrap(line,60))));time=end
(root/'SCRIPT.md').write_text('\n'.join(md))
(root/'SCRIPT.txt').write_text('\n'.join(plain))
(root/'narration.vtt').write_text('WEBVTT\n\nNOTE Draft pacing cues. Align to the actual human recording before submission.\n\n'+'\n\n'.join(f'{clock(s,True)} --> {clock(e,True)}\n{text}' for s,e,text in cues)+'\n')
(root/'narration.srt').write_text('\n\n'.join(f'{i+1}\n{clock(s,True,True)} --> {clock(e,True,True)}\n{text}' for i,(s,e,text) in enumerate(cues))+'\n')
print(sum(len(c['script'].split()) for c in data['chapters']),'words;',len(cues),'draft caption cues')
