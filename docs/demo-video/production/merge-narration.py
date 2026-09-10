#!/usr/bin/env python3
"""Merge a real human recording with the 3:59 visual edit; never synthesize speech."""
import argparse, json, pathlib, subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('audio',type=pathlib.Path)
p.add_argument('--offset',type=float,default=0,help='Delay speech by this many seconds; negative trims the beginning.')
p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('aivy-quorum-narrated.mp4'))
a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1];video=root/'aivy-quorum-visual-cut.mp4'
if not a.audio.is_file():p.error('Audio file does not exist.')
if a.output.exists():p.error('Output exists. Choose a new filename to preserve it.')
meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(a.audio)]))
if not any(s.get('codec_type')=='audio' for s in meta['streams']):p.error('The supplied file contains no audio.')
try: duration=float(meta['format']['duration'])
except (KeyError,ValueError):
    # MediaRecorder WebM often omits container duration; inspect audio packet times.
    packets=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','a:0','-show_entries','packet=pts_time,duration_time','-of','json',str(a.audio)]))
    ends=[float(x.get('pts_time',0))+float(x.get('duration_time',0)) for x in packets.get('packets',[])]
    if not ends:p.error('The audio recording has no readable packets.')
    duration=max(ends)
if duration+a.offset>239.1:p.error('The take extends past the 3:59 edit. Re-record or adjust the edit; this tool will not silently cut your speech or speed up the video.')
filters=[]
if a.offset<0:filters+=['atrim=start='+str(-a.offset),'asetpts=PTS-STARTPTS']
elif a.offset>0:filters+=['adelay='+str(round(a.offset*1000))+':all=1']
filters+=['loudnorm=I=-16:TP=-1.5:LRA=11','apad']
subprocess.run(['ffmpeg','-hide_banner','-i',str(video),'-i',str(a.audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',','.join(filters),'-c:a','aac','-b:a','192k','-t','239','-movflags','+faststart',str(a.output)],check=True)
print('Exported:',a.output.resolve())
print('Watch the entire export and check narration timing before submission. Draft subtitle cues need alignment to your actual voice.')
