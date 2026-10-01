/* Shared design tokens. Recipes below contain content and references, not copies
 * of SVGs or per-logo typography coordinates. All distances use the same 676-unit
 * badge design space; scale the entire SVG to choose output size. */
(function (global) {
'use strict';
const deepFreeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')deepFreeze(v);return Object.freeze(o);};
// advance: the probe text's width (em) in the exact face the calibration used.
// The engine compares it with the loaded face, so a different binary, weight or
// width is reported instead of silently changing the fit.
const FACE_PROBE='Hamburgefonstiv FORESTS 1234';
const FACES={
 'noto-condensed':{family:'Noto Sans Condensed',weight:800,advance:13.58798,stretch:'condensed',locals:['Noto Sans Condensed ExtraBold','NotoSans-CondensedExtraBold'],google:'Noto+Sans:wdth,wght@75,800',fallback:'"Arial Narrow", Arial, sans-serif',label:'Noto Sans Condensed ExtraBold · substitute'},
 'open-heavy':{family:'Open Sans',weight:800,advance:16.19873,locals:['Open Sans ExtraBold','OpenSans-Extrabold'],google:'Open+Sans:wght@800',fallback:'Arial, sans-serif',label:'Open Sans ExtraBold · substitute'},
 'open-bold':{family:'Open Sans',weight:700,advance:15.77198,locals:['Open Sans Bold','OpenSans-Bold'],google:'Open+Sans:wght@700',fallback:'Arial, sans-serif',label:'Open Sans Bold · substitute'},
 'condensed-bold':{family:'Roboto Condensed',weight:700,advance:13.11573,locals:['Roboto Condensed Bold','RobotoCondensed-Bold'],google:'Roboto+Condensed:wght@700',fallback:'"Arial Narrow", Arial, sans-serif',label:'Roboto Condensed Bold · substitute'},
 'condensed-heavy':{family:'Roboto Condensed',weight:800,advance:13.17139,locals:['Roboto Condensed ExtraBold','RobotoCondensed-ExtraBold'],google:'Roboto+Condensed:wght@800',fallback:'"Arial Narrow", Arial, sans-serif',label:'Roboto Condensed ExtraBold · substitute'},
 'inter-black':{family:'Inter',weight:900,advance:16.34522,locals:['Inter Black','Inter-Black'],google:'Inter:wght@900',fallback:'"Arial Black", Arial, sans-serif',label:'Inter Black · substitute'},
 'slab-bold':{family:'Roboto Slab',weight:700,advance:15.52247,locals:['Roboto Slab Bold','RobotoSlab-Bold'],google:'Roboto+Slab:wght@700',fallback:'Rockwell, Georgia, serif',label:'Roboto Slab Bold · substitute'},
 'slab-medium':{family:'Roboto Slab',weight:500,advance:15.41114,locals:['Roboto Slab Medium','RobotoSlab-Medium'],google:'Roboto+Slab:wght@500',fallback:'Rockwell, Georgia, serif',label:'Roboto Slab Medium · substitute'},
 'sans-regular':{family:'Roboto',weight:400,advance:14.65528,locals:['Roboto Regular','Roboto-Regular'],google:'Roboto:wght@400',fallback:'Arial, sans-serif',label:'Roboto Regular · substitute'},
 'sans-bold':{family:'Roboto',weight:700,advance:14.88086,locals:['Roboto Bold','Roboto-Bold'],google:'Roboto:wght@700',fallback:'Arial, sans-serif',label:'Roboto Bold · substitute'}
};
// Change a role once: every slot/recipe using it updates together.
const ROLES={
 'crest-heavy':{face:'open-heavy',capScale:1,trackingEm:0},
 'crest-service-upper':{face:'condensed-bold',capScale:1,trackingEm:0},
 'crest-condensed':{face:'condensed-bold',capScale:1,trackingEm:0},
 'crest-thin':{face:'sans-regular',capScale:1,trackingEm:0},
 'service-heavy':{face:'open-heavy',capScale:1,trackingEm:0},
 'service-condensed':{face:'condensed-bold',capScale:1,trackingEm:0},
 'wordmark-heavy':{face:'open-heavy',capScale:1,trackingEm:.082},
 'descriptor-slab':{face:'slab-bold',capScale:1,trackingEm:.070},
 'district-slab':{face:'slab-bold',capScale:1,trackingEm:0},
 'plain-label':{face:'sans-regular',capScale:1,trackingEm:0},
 'branch-condensed':{face:'condensed-bold',capScale:1,trackingEm:0}
};
// cap = measured H height, not font-size. baseline radii and anchorCap are
// reference-derived family tokens. Shrinking keeps the ink midline in the band.
const SLOTS={
 'wildlife-upper':{role:'crest-heavy',side:'top',cap:51.42037,anchorCap:52,rx:239.89365,ry:332.15782,span:170,maxSpan:177,tracking:0.01157,minTracking:0,endPad:12,minCap:29},
 'wildlife-lower':{role:'crest-heavy',side:'bottom',cap:47.5561,anchorCap:48.5,rx:302.62174,ry:379.46732,span:116,maxSpan:165,tracking:0.14149,minTracking:.012,endPad:14,minCap:29},
 'long-upper':{role:'crest-condensed',side:'top',cap:53,anchorCap:53,rx:249,ry:334,span:116,maxSpan:116,tracking:0,minTracking:0,endPad:16,minCap:28},
 'long-lower':{role:'crest-condensed',side:'bottom',cap:50,anchorCap:50,rx:290,ry:379,span:240,maxSpan:240,tracking:0,minTracking:0,endPad:20,minCap:27},
 'tree-upper':{role:'crest-service-upper',side:'top',cap:62.36874,anchorCap:62,rx:232.06115,ry:322.96198,span:172,maxSpan:177,tracking:0.00156,minTracking:0,endPad:12,minCap:30},
 'tree-lower':{role:'crest-heavy',side:'bottom',cap:62.5,anchorCap:62.5,rx:296.07,ry:381.95,span:183,maxSpan:188,tracking:.054,minTracking:0,endPad:12,minCap:30},
 'thin-upper':{role:'crest-thin',side:'top',cap:50,anchorCap:50,rx:247,ry:326,span:192,maxSpan:192,tracking:.022,minTracking:0,endPad:14,minCap:28},
 'thin-lower':{role:'crest-thin',side:'bottom',cap:44,anchorCap:44,rx:280,ry:382,span:193,maxSpan:193,tracking:.027,minTracking:0,endPad:14,minCap:26},
 'service-bottom':{role:'service-heavy',side:'bottom',cap:48.04678,anchorCap:48,rx:402.36543,ry:484.21603,span:108,maxSpan:108,tracking:0.04075,minTracking:0,endPad:22,minCap:27},
 'management-top':{role:'service-condensed',side:'top',cap:46,anchorCap:48,rx:389,ry:466,y:-20,span:108,maxSpan:108,tracking:0,minTracking:0,endPad:48,minCap:27},
 'plate-label':{role:'crest-thin',side:'flat',cap:65,anchorCap:65,width:570,y:902.5,tracking:.15,minTracking:.01,minCap:28},
 'wings-label':{role:'plain-label',side:'bottom',cap:45,anchorCap:45,rx:431,ry:475,span:98,maxSpan:98,tracking:.035,minTracking:0,endPad:20,minCap:27}
};
// Reference-calibrated defaults, opt-in. Raster sources are not font masters.
const REFERENCE_LETTERING={
  "version": 1,
  "roles": {
    "crest-condensed": {
      "face": "noto-condensed"
    }
  },
  "slots": {
    "wildlife-upper": {
      "referenceProfile": "caps-upper",
      "heightModel": "cap",
      "cap": 51.33546,
      "anchorCap": 51.33546,
      "rx": 240.54227,
      "ry": 331.82892,
      "tracking": 0.018897,
      "minTracking": -0.025,
      "wordSpacingEm": -0.0807292,
      "anchorBias": 4.05834
    },
    "wildlife-lower": {
      "referenceProfile": "caps-lower",
      "heightModel": "cap",
      "cap": 47.99913,
      "anchorCap": 47.99913,
      "rx": 300.30455,
      "ry": 379.37993,
      "tracking": 0.1360178,
      "minTracking": -0.025,
      "wordSpacingEm": 0.0,
      "anchorBias": -1.48416
    },
    "long-upper": {
      "referenceProfile": "long-upper",
      "heightModel": "xHeight",
      "cap": 44.02432,
      "anchorCap": 44.02432,
      "rx": 242.30809,
      "ry": 336.86689,
      "tracking": -0.0031887,
      "minTracking": -0.025,
      "wordSpacingEm": -0.0717636,
      "anchorBias": -0.96171,
      "xHeight": 34.4538143,
      "span": 116,
      "maxSpan": 116,
      "endPad": 12
    },
    "long-lower": {
      "referenceProfile": "long-lower",
      "heightModel": "xHeight",
      "cap": 50.93773,
      "anchorCap": 50.93773,
      "rx": 291.49392,
      "ry": 371.2928,
      "tracking": -0.0059276,
      "minTracking": -0.025,
      "wordSpacingEm": 0.0091981,
      "anchorBias": 0.10978,
      "xHeight": 39.8643114,
      "span": 240,
      "maxSpan": 250,
      "endPad": 12
    }
  },
  "serviceByCrest": {
    "wildlife-caps": {
      "referenceProfile": "caps-service",
      "heightModel": "cap",
      "cap": 48.09953,
      "anchorCap": 48.09953,
      "rx": 401.9501,
      "ry": 484.38091,
      "tracking": 0.0396145,
      "minTracking": -0.025,
      "wordSpacingEm": 0.0044799,
      "anchorBias": 0.42209
    },
    "wildlife-long": {
      "referenceProfile": "long-service",
      "heightModel": "cap",
      "cap": 46.91702,
      "anchorCap": 46.91702,
      "rx": 397.65813,
      "ry": 481.42089,
      "tracking": 0.0510101,
      "minTracking": -0.025,
      "wordSpacingEm": 0.0379432,
      "anchorBias": -1.15636
    }
  }
};
// separatorInset: the marks sit on the separator band drawn in by this many
// units (measured: wildfire-source.svg for the capitals crest; both long-crest
// rasters, which agree, for the long crest).
// separatorHomeY: where marks that follow the lettering sit while the lines
// leave room (the sides; both wildlife crests share the capitals position).
// ringOffset: with centreInRing, lines centre this many units outside (+) or
// inside (-) the ring's centre line. The Forest Service vector sets both lines
// about 4.5 units inward; the wildlife references sit within 2 units of centre.
// longer / shorter: a crest pair's long and short profiles, picked from the
// lower wording with autoProfile (engine effectiveCrest); switchCap is the cap
// height the short profile measures it at. tree-long reuses the long-ministry
// slots on the tree scene with diamonds scaled like the wildlife pair's marks
// (no tree reference has long wording).
// fan: how far the long crest's upper line may spread toward the capitals
// look while its marks are at home (engine fanUpper): letter height x1.166
// (the capitals upper cap height), spacing and word spacing, until its ends
// are clearance units from the marks (BRITISH COLUMBIA in the Forests reference).
const CRESTS={
 'wildlife-caps':{scene:'wildlife',upper:'wildlife-upper',lower:'wildlife-lower',separator:'circle',separatorY:446,separatorSize:12.65,separatorInset:3.34,separatorHomeY:446,longer:'wildlife-long',switchCap:46},
 'wildlife-long':{scene:'wildlife',upper:'long-upper',lower:'long-lower',separator:'circle',separatorY:215,separatorSize:9,separatorInset:7.67,separatorHomeY:446,fan:{capScale:1.166,trackingEm:.06,wordSpacingEm:0,span:200,clearance:129},shorter:'wildlife-caps'},
 'tree-heavy':{scene:'tree',upper:'tree-upper',lower:'tree-lower',separator:'diamond',separatorY:397.65,separatorSize:16.76,separatorHomeY:397.65,longer:'tree-long',switchCap:60,ringOffset:-4.5},
 'tree-long':{scene:'tree',upper:'long-upper',lower:'long-lower',separator:'diamond',separatorY:215,separatorSize:11.92,separatorInset:7.67,separatorHomeY:397.65,fan:{capScale:1.166,trackingEm:.06,wordSpacingEm:0,span:200,clearance:129},shorter:'tree-heavy',ringOffset:-4.5},
 'tree-thin':{scene:'tree',upper:'thin-upper',lower:'thin-lower',separator:'none',separatorY:397.65,separatorSize:0}
};
// Shapes the engine draws itself, not taken from the artwork. The generator in
// ../shared-primitives reads these tables too, so both draw the same pieces.
// Separators sit on the ellipse separatorBand (about the crest centre): at their
// crest's separatorY, or between the lettering's ends (engine separatorLayout).
// rings: the white lettering ring of each scene's frame, as [rx, ry] of its
// inner and outer edges about the centre: the wildlife frame's own ellipses, and
// a fit to the rendered tree frame (within 0.4 units outside, 2.2 inside).
const SHAPES={
 centre:[338.36631,420.96480],
 rings:{wildlife:{inner:[222.52573,313.12995],outer:[310.34551,398.06377]},tree:{inner:[222.83,313.41],outer:[310.74,398.52]}},
 separatorBand:{rx:266,ry:369},
 plate:{x:20,y:805,width:637,height:130,rx:3,strokeWidth:16},
 wings:{outline:'M 106 350 L -297 350 Q -340 350 -326 383 Q -318 408 -270 410 Q -297 440 -241 448 Q -262 478 -205 482 Q -215 511 -149 516 L 112 516 L 160 438 Z',rules:[[-279,402],[-249,440],[-212,478]],ruleEnd:106,fill:'#e4c681',stroke:'#172747',strokeWidth:12,ruleWidth:5,
  band:'M 27 656 Q 338 919 650 656 L 723 736 Q 338 1103 -46 736 Z',bandFill:'#ead49b',bandStrokeWidth:13,textFill:'#8e3d2b'}
};
// Recolouring: each source artwork colour and the theme token that replaces it.
const RECOLOUR={'#000000':'ink','#ffffff':'paper','#fff':'paper','#231f20':'ink','#1f1a17':'ink','#15864a':'tree','#185192':'wildlife','#478cca':'water','#604b3d':'earth','#70c6ea':'sky','#93d0aa':'distant','#008450':'tree','#0091c4':'water','#4b3216':'earth','#6dc9ef':'sky'};
// holder 'oval': no traced master; the holder is built on the frame's outer
// oval (tab-layout.js) so it sits on the oval's border, at halfSpan degrees
// either side (the Wildfire Management patch: its wording needs 59.9 at its
// cap height). It used to be the lower ribbon flipped and scaled x1.1, which
// floated 39 units above the oval.
const TABS={
 none:{shape:'none'},
 'wildfire-bottom':{shape:'ribbon',side:'bottom',slot:'service-bottom',width:1,height:1,y:0},
 'management-top':{shape:'ribbon',side:'top',slot:'management-top',holder:'oval',halfSpan:60},
 parks:{shape:'plate',slot:'plate-label'},
 airtanker:{shape:'wings',slot:'wings-label',experimental:true}
};
const THEMES={
 wildlife:{ink:'#000000',paper:'#ffffff',text:'#15864a',sky:'#70c6ea',water:'#478cca',wildlife:'#185192',distant:'#93d0aa',earth:'#604b3d',tree:'#15864a',word:'#087e4c',descriptor:'#171717',strip:'#211d1b',stripText:'#ffffff'},
 forest:{ink:'#231f20',paper:'#ffffff',text:'#231f20',sky:'#6dc9ef',water:'#0091c4',wildlife:'#185192',distant:'#93d0aa',earth:'#4b3216',tree:'#008450',word:'#008450',descriptor:'#231f20',strip:'#211d1b',stripText:'#ffffff'},
 mono:{ink:'#000000',paper:'#ffffff',text:'#000000',sky:'#ffffff',water:'#ffffff',wildlife:'#000000',distant:'#ffffff',earth:'#000000',tree:'#000000',word:'#000000',descriptor:'#000000',strip:'#000000',stripText:'#ffffff'},
 parks:{ink:'#dfbd4f',paper:'#163d32',text:'#dfbd4f',sky:'#8d9f95',water:'#516777',wildlife:'#dfbd4f',distant:'#b8b66b',earth:'#ab9a59',tree:'#008450',word:'#dfbd4f',descriptor:'#dfbd4f',strip:'#163d32',stripText:'#dfbd4f'},
 gold:{ink:'#d9b553',paper:'#172747',text:'#d9b553',sky:'#172747',water:'#172747',wildlife:'#d9b553',distant:'#d9b553',earth:'#d9b553',tree:'#d9b553',word:'#d9b553',descriptor:'#d9b553',strip:'#172747',stripText:'#d9b553'}
};
const LOCKUPS={
 badge:{kind:'badge'},
 horizontal:{kind:'horizontal',wordWidth:1430,gap:80,wordCap:373,descCap:108,districtCap:84,lineGap:66,centerY:408.5},
 'horizontal-compact':{kind:'horizontal',wordWidth:1000,gap:60,wordCap:300,descCap:82,districtCap:65,lineGap:26},
 words:{kind:'words',wordWidth:830,gap:99,labelCap:119,lineGap:43},
 wordmark:{kind:'wordmark',wordWidth:1340,wordCap:290,descCap:85,districtCap:65,lineGap:30},
 strip:{kind:'strip',width:3900,height:300,barY:243,textCap:130},
 stacked:{kind:'stacked',wordWidth:1400,gap:60,wordCap:340,descCap:99,districtCap:80,lineGap:30}
};
const longName='Forests, Lands and Natural Resource Operations';
const RECIPES=[
 {id:'forests',name:'Forests',crest:'wildlife-caps',tab:'none',layout:'badge',theme:'wildlife',content:{upper:'BRITISH COLUMBIA',lower:'FORESTS'},reference:'wildlife-source',confidence:'Reference-derived'},
 {id:'forests-wildfire',name:'Forests · Wildfire Service',extends:'forests',tab:'wildfire-bottom',tabBacking:'transparent',content:{service:'WILDFIRE SERVICE'},reference:'wildfire-source'},
 {id:'long-ministry',name:'Long ministry',crest:'wildlife-long',tab:'none',layout:'badge',theme:'wildlife',content:{upper:'British Columbia',lower:longName},reference:'wildlife-long',confidence:'Small raster reference'},
 {id:'long-wildfire',name:'Long ministry · Wildfire',extends:'long-ministry',tab:'wildfire-bottom',content:{service:'WILDFIRE SERVICE'},reference:'wildlife-long-ribbon'},
 {id:'forest-service',name:'Forest Service',crest:'tree-heavy',tab:'none',layout:'badge',theme:'forest',content:{upper:'FOREST SERVICE',lower:'BRITISH COLUMBIA'},reference:'tree-source',confidence:'Supplied vector reference'},
 {id:'wildfire-management',name:'Wildfire Management',extends:'forest-service',tab:'management-top',content:{service:'WILDFIRE MANAGEMENT'},reference:'wildfire-management',confidence:'Photographic approximation'},
 {id:'parks',name:'Forest Service · Parks',extends:'forest-service',crest:'tree-thin',tab:'parks',theme:'parks',content:{service:'PARKS'},reference:'parks',confidence:'Photographic approximation'},
 {id:'bcts-wildlife',name:'BCTS · wildlife crest',extends:'long-ministry',layout:'horizontal-compact',content:{word:'BCTS',descriptor:'BC Timber Sales'},reference:'bcts-wildlife'},
 {id:'bcts-tree',name:'BCTS · Forest Service',extends:'forest-service',layout:'horizontal',content:{word:'BCTS',descriptor:'BC Timber Sales'},reference:'bcts-tree'},
 {id:'bcts-district',name:'BCTS · district',extends:'bcts-tree',content:{district:'Chinook'},reference:'bcts-district',confidence:'Small raster reference'},
 {id:'bcts-stacked-words',name:'BC / Timber / Sales',extends:'forest-service',layout:'words',content:{lines:'BC\nTimber\nSales'},reference:'bcts-stack'},
 {id:'bcts-wordmark',name:'BCTS · wordmark only',extends:'bcts-tree',layout:'wordmark',reference:'bcts-only'},
 {id:'branch-strip',name:'Forest Analysis & Inventory',extends:'forest-service',layout:'strip',theme:'mono',content:{branch:'FOREST ANALYSIS AND INVENTORY BRANCH'},reference:'branch-strip'},
 {id:'airtanker',name:'Airtanker Operations',extends:'forest-service',tab:'airtanker',theme:'gold',content:{service:'AIRTANKER OPERATIONS'},reference:'airtanker',confidence:'Experimental · photo approximation'},
 {id:'fire-control',name:'Fire Control · excluded',extends:'forest-service',tab:'management-top',content:{service:'FIRE CONTROL'},reference:'fire-control',excluded:true,confidence:'Excluded · distorted reference; no calibration'}
];
function recipe(id,seen=new Set()){
 const r=RECIPES.find(x=>x.id===id);if(!r)throw new Error('Unknown recipe: '+id);
 if(seen.has(id))throw new Error('Cyclic recipe inheritance');seen.add(id);
 const p=r.extends?recipe(r.extends,seen):{content:{},confidence:'Generated interpretation'};
 return {...p,...r,content:{...p.content,...r.content}};
}
global.BCPrimitives=deepFreeze({version:5,FACE_PROBE,FACES,ROLES,SLOTS,REFERENCE_LETTERING,CRESTS,SHAPES,RECOLOUR,TABS,THEMES,LOCKUPS,RECIPES,recipe});
})(window);
