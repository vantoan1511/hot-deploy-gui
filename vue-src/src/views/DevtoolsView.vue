<script setup lang="ts">
</script>

<template>
  <div class="devtools-page">
    <iframe
      src="https://devtoo1s.vercel.app/"
      class="devtools-frame"
      frameborder="0"
      allow="fullscreen"
    />
  </div>
</template>

<style scoped>
.devtools-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.devtools-frame {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
