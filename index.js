class Vue {
  constructor(options={}){
    const vm = this
    vm.$options = {
      ...options
    }
    vm.data = vm.$options.data
    this._initData();
    this._initMethods(vm.$options.methods)
    vm.$options.el = document.querySelector(vm.$options.el)

    vm.$mount(vm.$options.el)  // 挂在组件
  }
  _initData() {
    const vm = this
    const data = vm.data;
    for (let key in data){
      //把data中的属性输出到this上
      Object.defineProperty(vm, key, {
        enumerable: true,
        configurable: true,
        get: function(){
          return this.data[key]
        },
        set: function(val){
          this.data[key] = val;
        },
      });
    }
    this._observer = new Observer(data,vm)
  }
  _initMethods(methods) {
    for(let fn in methods){
      this[fn] = methods[fn]
    }
  }
  $mount(el) {
    if(!el){
      throw ("Can't find el")
    }
    if(el===document.body|| el === document.documentElement){
      throw ("el can't use <html> <body>")
    }
    const vm = this
    const options = vm.$options
    let template = options.template
    // 获取整个 innerHTML 包括节点本身
    if(!template||typeof template !== 'string'){
      const container = document.createElement('div')
      container.appendChild(el.cloneNode(true))
      template = container.innerHTML
    }
    const { render } = vm.compile(template)
    // options.render = render
    vm._renderProxy = new Proxy(vm, {
      has (target, key) {
        var has = key in target;
        var isAllowed = typeof key === 'string' && key.charAt(0) === '_' && !(key in target.data);
        return has || !isAllowed
      }
    });
    // 编译虚拟DOM时需要用到的方法
    vm._c = function(tag,data,children){return new VNode(tag, data, children,undefined, vm); }
    vm._v = createTextVNode
    vm._e = createEmptyVNode
    vm._s = _s
    const renderFn = createFunction(render)
    vm.$options.render = renderFn
    vm._wachers = new Watcher(vm,()=>{
      const vnode = vm._render();
      vm.$el = this._patch(null,vnode);
      vm._vnode = vnode
    })
  }
  _render() {
    const vm = this
    return vm.$options.render.call(vm._renderProxy, vm.$createElement);
  }
  _update() {
    const vm = this
    var prevVnode = vm._vnode;
    vm._vnode  = vm._render()
    vm.$el = vm._patch(prevVnode, vm._vnode);
  }
  _patch(oldVnode,newVnode) {
    // 还没有增加diff
    if (oldVnode === newVnode) {
      return
    }
    const vm = this
    const parent = this.$options.el.parentNode
    nodeFn.removeChild(parent,vm.$options.el)
    // 创建真实节点
    function createElement(parent,node,root){
      node.parent = parent
      let elm 
      if(node.tag){
        elm = nodeFn.createElement(node.tag) //标签
      }else if(node.isComment){
        elm = nodeFn.createComment(node.text)  //注释
      }else{
        elm = nodeFn.createTextNode(node.text)  //文本
      }
      node.elm = elm
      if(node.data){
        if(node.data.attrs){
          const attrs = node.data.attrs
          for( let key in attrs){
            elm.setAttribute(key, attrs[key]);
          }
        }
        if(node.data.on){
          for(let event in node.data.on){
            elm.addEventListener(event,vm[node.data.on[event]].bind(vm))
          }
        }
      }
      //TODO 添加事件等
      if(root){
        vm.$options.el = elm
        nodeFn.insertBefore(parent,elm,vm.$options.el.nextSibling)
      }else{
        nodeFn.appendChild(parent,elm)
      }
      if(node.children&&node.children.length){
        node.children.forEach(v=>createElement(elm,v))
      }
    }
    createElement(parent,newVnode,true)
    return newVnode.elm
  }
  $createElement(tag, data, children) { 
    const vm = this
    return new VNode(tag, data, children,undefined, vm); 
  }
  compile(template){
      const ast = this._parse(template.trim())
      console.log(ast)
      const code = this._generate(ast)
      return {
        ast,
        render: ("with(this){return " + code + "}"), //传入this变量  可以看下with的用法
      }
  }
  _parse(template){
    let last, lastTag
    const startTagRe = /^<([^>\s\/]+)((\s+[^=>\s]+(\s*=\s*((\"[^"]*\")|(\'[^']*\')|[^>\s]+))?)*)\s*\/?\s*>/m
    const endTagRe = /^<\/([^>\s]+)[^>]*>/m
    const attrRe = /([^=\s]+)(\s*=\s*((\"([^"]*)\")|(\'([^']*)\')|[^>\s]+))?/gm
    const comment = /^<!\--/
    const tempJsRe = /\{\{((?:.|\r?\n)+?)\}\}/g
    let root
    let currentParent
    let i=0
    let html = template
    while (html.length>0) {
      i++
      if(i>template.length/10)break
      // console.log('当前剩余html----------\n',html)
      last = html
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // 如果是注释 可以保留或者剔除
        if (comment.test(html)) {
          // console.log('碰到注释----------')
          const end = html.indexOf('-->')
          if (~end) {
            currentParent.children.push({
              type: 3,
              text: html.substring(4, end),
              isComment: true,
              parent: currentParent
            })
            html = html.substring(end + 3).trim()
            continue
          }
        }
        else if (html.substring(0, 2) == "</") {
          // console.log('碰到end标签-----------')
          if (endTagRe.test(html)) {
              const lc = RegExp.leftContext;
              const lm = RegExp.lastMatch;
              const rc = RegExp.rightContext;
              lm.replace(endTagRe,parseEndTag);
              html = rc.trim();
              continue
          }
        }
        // 起点标签
        else if (html.charAt(0) == "<") {
          // console.log('碰到start标签----------')
          if (startTagRe.test(html)) {
            const lc = RegExp.leftContext;
            const lm = RegExp.lastMatch;
            const rc = RegExp.rightContext;
            const that = this
            lm.replace(startTagRe,parseStartTag);
            html = rc.trim();
            continue
          }
        }
      }
      let text, rest, next
      if (textEnd >= 0) {
        text = html.substring(0, textEnd)
      }
      if (textEnd < 0) {
        text = html
      }
      if (text) {
        const _textData = {
          type: 3,
          text: text,
          parent: currentParent,
          static: true // 静态文本节点
        }
        if(tempJsRe.test(text)){
          _textData.type = 2
          // 如果有模版js {{}}
          _textData.expression = parseText(text)
          _textData.static = false // 静态文本节点
        }
        currentParent.children.push(_textData)
        html = html.substring(text.length).trim()
        // console.log('碰到文本-----------',text)
      }
      if (html === last) {
        currentParent.children.push({
          type: 3,
          text: html,
          parent: currentParent
        })
        break
      }
    }
    // end标签
    function parseEndTag(tag, tagName){
      // console.log('当前end标签------------',tagName)
      currentParent = currentParent.parent // 遇到end标签，跳出当前标签
    }
    // start标签
    function parseStartTag (tag, tagName, rest) {
      const attrs = []
      rest.replace(attrRe, function(a0, a1, a2, a3, a4, a5, a6) {
        attrs.push(parseAttribute(tagName, a0, a1, a2, a3, a4, a5, a6));
      });
      lastTag = tagName
      // console.log('当前start标签------------',lastTag,attrs)
      if(!root){
        root = {
          type: 1,
          tag: tagName,
          children: [],
        }
        root.parent = root
        currentParent = root
      }else {
        currentParent.children.push({
          type: 1,
          tag: tagName,
          children: [],
          parent: currentParent
        })
        currentParent = currentParent.children[currentParent.children.length-1] // 遇到start标签，开辟新的结构，继续向内部遍历
      }
      currentParent.attrsList = attrs
    }
    // 返回属性
    function parseAttribute (tagName, Attr, name) {
      var value = "";
      if (arguments[7]) value = arguments[8];
      else if (arguments[5]) value = arguments[6];
      else if (arguments[3]) value = arguments[4];
      var empty = !value && !arguments[3];
      return {
          name: name,
          value: empty ? null : value
      };
    }
    // 将文本中的模版js提取出来
    function parseText(text) {
      const expressionList = [];
      let lastIndex = tempJsRe.lastIndex = 0;
      let match, index, tokenValue;
      while (match = tempJsRe.exec(text)) {
        index = match.index;
        if (index > lastIndex) expressionList.push(JSON.stringify(tokenValue));
        let exp = match[1].trim();
        expressionList.push(("_s(" + exp + ")"));
        lastIndex = index + match[0].length;
      }
      return expressionList.join('+')
    }
    return root
  }
  _generate(el){
    const code = getElement(el)
    return code
  }

}

class VNode {
  constructor(tag, data, children,text, context){
  this.tag = tag;
  this.data = data;
  this.children = children;
  this.text = text;
  this.context = context;
  }
}

class Observer {
  constructor(value,vm){
    this.value = value;
    this.vm = vm
    this.walk(value);
    this.dep = new Dep();
  }
  walk (obj) {
    var dep = new Dep();
    const vm =  this.vm
    vm.data = new Proxy(obj, {
      get (target, key) {
        const data = target[key]
        // 第一次加载this.data时 Dep.target 有值，可以绑定依赖
        if(Dep.target){
          dep.depend();
        }
        return data
      },
      set(target,key,value){
        let res =  Reflect.set(target, key, value)
        dep.notify();
        return res
      }
    })
    // defineProperty 版本
    // const keys = Object.keys(obj);
    // for (let i = 0; i < keys.length; i++) {
      // const key = keys[i]
      // const value = obj[key]
      // Object.defineProperty(obj, key, {
      //   enumerable: true,
      //   configurable: true,
      //   get() {
      //     return value
      //   },
      //   set(newVal) {
      //   }
      // });
    // }
  }
}
class Watcher {
  constructor (vm, Fn) {
    this.vm = vm
    this.Fn = Fn
    this.depIds = new Set(); // 存储depId
    this.value = this.getThis()// 需要最后执行。第一次渲染
  }
  addDep(dep){
    if (!this.depIds.has(dep.id)) {
      dep.addSubscribe(this);//获取Dep实例，把自己的Watcher实例发送过去
      this.depIds.add(dep.id)
    }
  }
  update () {
    Promise.resolve().then(()=>{
      this.vm._update()
    })
  }
  getThis(){
    Dep.target = this
    this.Fn&&this.Fn() // 第一次渲染在这里 Dep.target 有值，绑定依赖
    Dep.target = null
  }
}
let uuid = 0
class Dep {
  constructor() {
    this.id = uuid ++ 
    this.subscribes = [];
  }
  depend() {
    Dep.target&&Dep.target.addDep(this); //Dep.target已经变成了Watcher，绑定依赖,把自己传到Watcher那边
  }
  addSubscribe(subscribe) {
    this.subscribes.push(subscribe);
  }
  notify() {
    const subscribes = this.subscribes;
    for (let i = 0;i < subscribes.length; i++) {
      subscribes[i].update(); //依次触发依赖
    }
  }
}
Dep.target = null //初始化
//转换为函数
function createFunction (code) {
  try {
    return new Function(code)
  } catch (err) {
    console.log(err,'err')
  }
}
// 输出文本
function _s (val){
  return val == null
  ? ''
  : typeof val === 'object'
    ? JSON.stringify(val, null, 2)
    : String(val)
}
// 获取标签上的各种属性
function getData (el){
  var data = '{';
  if (el.attrsList) {
    data += "attrs:{" + (getProps(el.attrsList.filter(item=>!item.name.startsWith('@')))) + "},";
  }
  const event = el.attrsList.filter(item=>item.name.startsWith('@'))
  if(event&&event.length){
    data += "on:{" +getHandlers(event) +"},"
  }
  //TODO 添加事件、自定义v-if等
  data = data.replace(/,$/, '') + '}';
  return data
}
//获取内容
function getNode(node){
  if (node.type === 1) {
    return getElement(node)
  } else if (node.type === 3 && node.isComment) {
    return getComment(node)
  } else {
    return getText(node)
  }
}
function getHandlers(events){
  let res = ""
  events.forEach(item=>{
    res += `"${item.name.replace("@",'')}":"${item.value}",`;
  })
  return res
}
//获取一般的html标签属性
function getProps (props) {
  var res = '';
  for (var i = 0; i < props.length; i++) {
    var prop = props[i];
    res += `"` + (prop.name) + `":"`+ (prop.value.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')) +`",`;
  }
  return res.slice(0, -1)
}
//节点，子节点
function getElement(el) {
  const data = getData(el);
  var children =("[" + (el.children.map(n=> getNode(n)).join(',')) + "]")
  code = "_c('" + (el.tag) + "'" + (data ? ("," + data) : '') + (children ? ("," + children) : '') + ")";
  return code
}
//注释
function getComment (comment) {
  return ("_e(" + (JSON.stringify(comment.text)) + ")")
}
//文本节点
function getText (text) {
  return ("_v(" + (text.type === 2
    ? text.expression
    : JSON.stringify(text.text).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')) + ")")
}
//创建空节点
function createEmptyVNode(text) {
  if ( text === void 0 ) text = '';
  var node = new VNode();
  node.text = text;
  node.isComment = true;
  return node
};
//创建文本vnode节点
function createTextVNode (val) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// 操作节点
const nodeFn = {
  createElement (tagName,vnode){
    // 创建节点，还有很多类型的比如select需要考虑
    return document.createElement(tagName);
  },
  createTextNode (text) {
    return document.createTextNode(text)
  },
  createComment (text) {
    return document.createComment(text)
  },
  appendChild (node, child) {
    node.appendChild(child);
  },
  removeChild (node, child) {
    node.removeChild(child);
  },
  parentNode (node) {
    return node.parentNode
  },
  insertBefore (parent, node, nNode) {
    parent.insertBefore(node, nNode);
  }
}
 