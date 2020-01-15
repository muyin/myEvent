/**
 * 发布订阅模式:支持“先订阅再发布”和 “先发布再订阅”； once和on的订阅互不影响。 by jk
 * 注意:
 *      1.先发布后订阅，先发布了几次，订阅时就会立即执行几次。
 *      2.先发布后订阅，once订阅时，不会将订阅加入列表。on订阅时，还会将订阅加入列表，再次使用emit发布执行
 *      3.once同on一样，订阅了几次,emit时就执行几次;此外once事件订阅与on事件订阅不相互影响,同nodejs相同
 *      4.目前先发布再订阅后，就无法对相同的事件再次进行先发布再订阅，只能进行先订阅再发布了。这么设计应该合理吧
 * 测试：
 *      var event = Event();
 *      var event1 = Event();  // 生成另一个发布订阅对象，与event订阅相同的事件也不相互影响   
 *      var fn1 = function(a){ console.log('方法1：',a); };
 *      var fn2 = function(a){ console.log('方法2：',a); };
 *      var fn3 = function(a){ console.log('once方法3：',a); };
 *      // 先发布再订阅。 
 *      event.emit('jk-b', '2四川'); event.emit('jk-b', '4成都');
 *      event.emit('jk-c', '3四川'); event.emit('jk-c', '6成都');
 *      event.on('jk-b', fn1);          // 显示"方法1: 2四川" 和 "方法1: 4成都"
 *      event.once('jk-c', fn2);        // 显示"方法2: 3四川" 和 "方法2: 6成都"
 *      event.emit('jk-b', 'jk2');      // 显示"方法1: jk2"，刚才on订阅时将方法加入了列表，可再次触发。看注意第二点
 *      event.emit('jk-c', 'jk3');      // 什么都不显示，先发布后订阅，once不将方法加入列表，无法再次触发。看注意第二点
 *      event.removeListener('jk-b');   // 清除'jk-b'事件的所有订阅方法
 *      event.emit('jk-b', 'jk4');      // 什么都不显示，因为清空了jk-b事件的所有订阅方法。
 *      event.on('jk-b', fn2);          // 什么都不显示，对同一事件只能进行一次先发布再订阅
 *      event.emit('jk-b', 'jk4');      // 显示"方法2: jk4"。只能进行先订阅再发布了
 *      // 先订阅再发布
 *      event1.once('jk-b', fn1);
 *      event1.once('jk-b', fn3);
 *      event1.on('jk-b', fn2);
 *      event1.on('jk-b', fn1);
 *      event1.on('jk-b', fn1);
 *      event1.emit('jk-b', '执行1');   // 显示 "方法2: 执行1", "方法1: 执行1", "方法1: 执行1" 和 "方法1: 执行1", "once方法3：执行1"
 *      event1.emit('jk-b', '执行2');   // 显示 "方法2: 执行2" 和 "方法1: 执行2" 和 "方法1: 执行2"。因为once只能执行一次
 *      event1.removeListener('jk-b', fn1);  // 清除'jk-d'事件的所有fn1方法
 *      event1.emit('jk-b', '执行3');   // 显示 "方法2：执行3"
 */
var Event = function(){
    var list = {},      // 存储事件名及方法{ key1:[fn1,fn2,...], key2:[...] }
        oncelist = {},  // 存储once事件名及方法{ key1:[fn1,fn2,...], key2:[...] }
        offline = {},   // 存储离线事件及相关参数.先发布后订阅用 { key1: [args1, args2,...], key2: [...] }
        _doOffline, _listen, _trigger, _remove, once, listen, trigger, remove;

    _doOffline = function(key, fn){
        // 先发布后订阅的情形，直接执行订阅的事件方法，并随后清空相关的事件及参数（即只能执行一次）
        for (var i=0, len=offline[key].length; i<len; i++) {
            var args = offline[key][i];
            fn.apply( this, args );     // apply的第二个参数为数组或类数组对象
        }
        offline[key] = null;            // 只能执行一次
    };
    _listen = function(cache, key, fn){
        if ( !cache[key] ) { cache[key] = []; }
        cache[key].push(fn);
    };
    // 注册事件方法。key: {String} 事件名， fn：{function} 处理事件函数
    listen = function(key, fn){
        _listen(list, key, fn); // 无论先发布再订阅，还是先订阅再发布，事件方法都要添加到列表
        if ( offline[key] ) {
            // 是先发布后订阅的情形
            _doOffline.call(this, key, fn);
        }
    };
    // 注册单次事件方法 key: {String} 事件名， fn：{function} 处理事件函数
    once = function(key, fn){
        if ( offline[key] ) {
            // 是先发布后订阅的情形，此时不将事件方法加入列表
            _doOffline.call(this, key, fn);
        } else {
            // 是先订阅后发布的情形
            _listen(oncelist, key, fn);
        }
    };
    _trigger = function(){
        var cache = Array.prototype.shift.call(arguments),  // 存储对象
            key = Array.prototype.shift.call(arguments),    // 事件名
            args = arguments,                               // 方法参数
            fns = cache[key];                               // 方法数组
        for (var i=0, fn; fn=fns[i]; i++) {
            fn.apply(this, args);
        }
    };
    // 触发事件方法。第一个参数是事件名(string)，以后的参数是处理事件函数的参数
    trigger = function(){
        var key =  Array.prototype.shift.call( arguments ),     // 事件名
            arrArgs = Array.prototype.slice.call(arguments);    // 方法参数数组。将arguments对象转换成真正的数组
        if ( !list[key] && !oncelist[key] ) {
            // 如果没有订阅事件，就缓冲事件名及参数，等订阅时再执行方法。即实现先发布后订阅
            if ( !offline[key] ) { offline[key] = []; }
            offline[key].push(arrArgs);
        } else {
            // 如果有订阅事件，就执行订阅事件。即先订阅后发布
            if ( list[key] && list[key].length > 0 ) {          // 该事件注册的是多次监听器
                _trigger.apply( this, [list, key].concat(arrArgs) );
            }
            if ( oncelist[key] && oncelist[key].length > 0 ) {  // 该事件注册的是单次监听器
                _trigger.apply( this, [oncelist, key].concat(arrArgs) );
                oncelist[key].length = 0;
            }
        }
    };
    _remove = function(cache, key, fn){
        var fns = cache[key];
        if (!fns) { return false; }
        if ( !fn ) {
            // 如果没有传方法，清空所有订阅的方法
            // 因为对象引用是地址。如果直接给fns赋一个新值会使fns指向一个新地址，而不会影响到原来的cache对象。
            // 故只修改fns的元素才能使其作用到cache。所以使用fns.length=0和fns.splice(),而不直接用fns=[]来置空cache[key]
            fns && (fns.length = 0);    
        } else {
            // 传了方法，清除指定订阅方法
            for (var l=fns.length-1; l>=0; l--) {
                var _fn = fns[l];
                if (_fn === fn) { fns.splice(l, 1); }
            }
        }
    };
    // 移除事件方法。key: {String} 事件名， fn：{function} 处理事件函数,没有传则移除所有事件方法
    remove = function(key, fn){
        if ( list[key] && list[key].length>0 ) { _remove(list, key, fn); }
        if ( oncelist[key] && oncelist[key].length>0 ) { _remove(oncelist, key, fn); }
    };
    return {
        emit: trigger,
        trigger: trigger,
        once: once,
        on: listen,
        addListener: listen,
        removeListener: remove,
    }
}