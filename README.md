# 实现一个简单的Vue
用于[博客](https://tyouzu1.github.io)
## 目标用例
```html
<div id="app">
  <div>
    Vue
    <p class="add" @click="add" >点我点我number:{{number}}</p>
    <a href="https://tyouzu1.github.io">{{message}}</a>
    <!--这里是---注释 -->
  </div>
</div>
<script>
var app = new Vue({
  el: '#app',
  data: {
    number: 1,
    message: "tyouzu1.github.io"
  },
  methods: {
    add() {
      this.number = this.number+1
    }
  }
})  
</script>
```