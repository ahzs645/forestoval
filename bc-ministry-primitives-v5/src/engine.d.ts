/** Browser globals after primitives.js and engine.js are loaded. */
export {};
declare global {
  type BCFaceId = 'open-heavy'|'open-bold'|'condensed-bold'|'condensed-heavy'|'inter-black'|'slab-bold'|'slab-medium'|'sans-regular'|'sans-bold';
  type BCRoleId = 'crest-heavy'|'crest-service-upper'|'crest-condensed'|'crest-thin'|'service-heavy'|'service-condensed'|'wordmark-heavy'|'descriptor-slab'|'district-slab'|'plain-label'|'branch-condensed';
  type BCCrestId = 'wildlife-caps'|'wildlife-long'|'tree-heavy'|'tree-thin';
  type BCTabId = 'none'|'wildfire-bottom'|'management-top'|'parks'|'airtanker';
  type BCLayoutId = 'badge'|'horizontal'|'horizontal-compact'|'words'|'wordmark'|'strip'|'stacked';
  type BCThemeId = 'wildlife'|'forest'|'mono'|'parks'|'gold';
  type BCSlotId = 'wildlife-upper'|'wildlife-lower'|'long-upper'|'long-lower'|'tree-upper'|'tree-lower'|'thin-upper'|'thin-lower'|'service-bottom'|'management-top'|'plate-label'|'wings-label';
  type BCRecipeId = 'forests'|'forests-wildfire'|'long-ministry'|'long-wildfire'|'forest-service'|'wildfire-management'|'parks'|'bcts-wildlife'|'bcts-tree'|'bcts-district'|'bcts-stacked-words'|'bcts-wordmark'|'branch-strip'|'airtanker'|'fire-control';
  interface BCRole {face:BCFaceId; capScale:number; trackingEm:number}
  interface BCSlot {role:BCRoleId; side:'top'|'bottom'|'flat'; cap:number; anchorCap:number; rx?:number; ry?:number; span?:number; maxSpan?:number; tracking:number; minTracking:number; endPad?:number; minCap:number; width?:number; y?:number}
  interface BCContent {upper?:string;lower?:string;service?:string;word?:string;descriptor?:string;district?:string;lines?:string;branch?:string}
  interface BCSharedRules {roles?:Partial<Record<BCRoleId,Partial<BCRole>>>;slots?:Partial<Record<BCSlotId,Partial<Pick<BCSlot,'cap'|'tracking'|'rx'|'ry'|'y'>>>>}
  interface BCConfiguration extends BCSharedRules {version:5;recipe:BCRecipeId;crest:BCCrestId;tab:BCTabId;layout:BCLayoutId;theme:BCThemeId;autoProfile:boolean;content:BCContent;colours:Record<string,string>;outputWidth:number}
  interface BCRecipe {id:BCRecipeId;name:string;extends?:BCRecipeId;crest?:BCCrestId;tab?:BCTabId;layout?:BCLayoutId;theme?:BCThemeId;content:BCContent;reference?:string;confidence?:string;excluded?:boolean}
  interface BCTypeReport {text:string;role:BCRoleId;slot?:BCSlotId;face:BCFaceId;weight:number;size:number;cap:number;preferredCap:number;tracking:number;trackingEm:number;width:number;widthBasis:'browser advance'|'visible ink';available:number;stage:'natural'|'tracking'|'arc-expanded'|'uniform-shrink';tooSmall:boolean;ascent:number;descent:number;curve?:{rx:number;ry:number;span:number}}
  interface BCRenderResult {svg:SVGSVGElement;state:BCConfiguration;report:BCTypeReport[];warnings:{code:string;message:string}[];viewBox:{x:number;y:number;w:number;h:number};nominal:{x:number;y:number;w:number;h:number};crest:BCCrestId;fontIds:BCFaceId[]}
  interface BCFaceStatus {status:'ready'|'fallback';source:'local'|'web'|'fallback';face:BCFaceId;family:string;weight:number;error?:string}
  const BCPrimitives: {
    readonly version:5;
    readonly FACES:Readonly<Record<BCFaceId,{family:string;weight:number;locals:readonly string[];google:string;fallback:string;label:string}>>;
    readonly ROLES:Readonly<Record<BCRoleId,Readonly<BCRole>>>;
    readonly SLOTS:Readonly<Record<BCSlotId,Readonly<BCSlot>>>;
    readonly CRESTS:Readonly<Record<BCCrestId,{scene:'wildlife'|'tree';upper:BCSlotId;lower:BCSlotId;separator:string;separatorY:number;separatorSize:number}>>;
    readonly TABS:Readonly<Record<BCTabId,{shape:string;slot?:BCSlotId;side?:string}>>;
    readonly THEMES:Readonly<Record<BCThemeId,Readonly<Record<string,string>>>>;
    readonly LOCKUPS:Readonly<Record<BCLayoutId,Readonly<Record<string,string|number>>>>;
    readonly RECIPES:readonly BCRecipe[];
    recipe(id:BCRecipeId):BCRecipe;
  };
  const BCLogo: {
    normalise(input?:Partial<BCConfiguration>):BCConfiguration;
    recipeState(id:BCRecipeId,shared?:BCSharedRules):BCConfiguration;
    render(input?:Partial<BCConfiguration>,options?:{prefix?:string;allowNetwork?:boolean}):Promise<BCRenderResult>;
    /** Synchronous only after ensureFonts()/render() has completed. */
    makeLogo(input?:Partial<BCConfiguration>,options?:{prefix?:string}):BCRenderResult;
    serialise(result:BCRenderResult|SVGSVGElement):string;
    png(result:BCRenderResult,width?:number):Promise<Blob>;
    ensureFonts(ids:BCFaceId[],allowNetwork?:boolean):Promise<BCFaceStatus[]>;
    retryFonts():void;
    invalidateMetrics():void;
    dependencies(role:BCRoleId):string[];
    role(id:BCRoleId,state:BCConfiguration):BCRole;
    slot(id:BCSlotId,state:BCConfiguration):BCSlot;
    readonly ART:Readonly<Record<string,string>>;
    readonly fontState:Map<BCFaceId,BCFaceStatus>;
    clone<T>(value:T):T;
  };
  interface Window {BCLogo:typeof BCLogo;BCPrimitives:typeof BCPrimitives}
}
