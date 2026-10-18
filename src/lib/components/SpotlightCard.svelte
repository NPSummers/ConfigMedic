<script lang="ts">
  let x = 50;
  let y = 50;

  function move(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    x = event.clientX - bounds.left;
    y = event.clientY - bounds.top;
  }
</script>

<div class="spotlight-card" role="presentation" style={`--spot-x:${x}px;--spot-y:${y}px`} on:mousemove={move}>
  <div class="spotlight-glow"></div>
  <div class="spotlight-content"><slot /></div>
</div>
