/*! Fuse.js v6.6.2 (萬寶屋創意實業社 oneball 客製優化版) */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).Fuse=t()}(this,(function(){"use strict";
function e(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}
function t(n){for(var r=1;r<arguments.length;r++){var o=null!=arguments[r]?arguments[r]:{};r%2?e(Object(o),!0).forEach((function(e){i(n,e,o[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(n,Object.getOwnPropertyDescriptors(o)):e(Object(o)).forEach((function(e){Object.defineProperty(n,e,Object.getOwnPropertyDescriptor(o,e))}))}return n}
function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}
function o(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}
function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}
function d(e){return null!=e}

var Fuse=function(){
    function e(t,n){
        r(this,e);
        this.options=Object.assign({
            location:0,distance:100,threshold:.4,maxPatternLength:32,
            isCaseSensitive:!1,minMatchCharLength:1,id:null,keys:[],shouldSort:!0
        },n);
        this.setCollection(t);
    }
    return o(e.prototype,[
        {key:"setCollection",value:function(e){this.list=e||[]}},
        {key:"search",value:function(e){
            var t=this,n=String(e||"").toLowerCase().trim();
            if(!n)return[];
            var r=[];
            this.list.forEach((function(e,o){
                var i=0,c=!1;
                t.options.keys.forEach((function(r){
                    var a=r.name||r,s=r.weight||1,u=e[a];
                    if(d(u)){
                        var l=Array.isArray(u)?u.join(" "):String(u);
                        var lLower=l.toLowerCase();
                        if(lLower.includes(n)){
                            c=!0;
                            i+=100*s;
                        }else{
                            var tokens=n.split(/\s+/);
                            var tokenHits=0;
                            tokens.forEach((function(tk){
                                if(tk && lLower.includes(tk)){
                                    tokenHits++;
                                }
                            }));
                            if(tokenHits>0){
                                c=!0;
                                i+=20*tokenHits*s;
                            }
                        }
                    }
                }));
                if(c){
                    r.push({item:e,refIndex:o,score:i});
                }
            }));
            r.sort((function(e,t){return t.score-e.score;}));
            return r;
        }}
    ]),e;
}();
return Fuse;
}));