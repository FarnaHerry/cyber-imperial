<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLayout from './layouts/AppLayout.vue'
import StudioPage from './pages/StudioPage.vue'
import EmperorPage from './pages/EmperorPage.vue'
import StudioIcon from './components/StudioIcon.vue'
import { useStudio } from './composables/useStudio'
import { palaceEdict, type DrawRecord } from './core/palace'

const studio = useStudio()
const { state, restored, saveStatus } = studio
const page = ref<'studio' | 'emperor'>(window.location.hash === '#emperor' ? 'emperor' : 'studio')
const studioPage = ref<InstanceType<typeof StudioPage> | null>(null)
const exportScale = ref<2 | 4>(2)
const exporting = ref(false)
const overflow = ref(false)
const toast = ref('')
let toastTimer = 0
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.value = '', 2800)
}
function navigate(target: 'studio' | 'emperor') { window.location.hash = target }
function onPageChange() { page.value = window.location.hash === '#emperor' ? 'emperor' : 'studio' }
function fromPalace(record: DrawRecord) {
  state.subject = record.name
  state.text = palaceEdict(record, state.kingdom, state.emperor)
  studioPage.value?.resetTemplate()
  navigate('studio')
  notify(`已为${record.name}拟旨，原有印痕保留`)
}
watch(() => state.theme, value => { document.documentElement.dataset.theme = value }, { immediate: true })
onMounted(() => { window.addEventListener('hashchange', onPageChange); if (restored) notify('已恢复上次的作品，继续落笔吧') })
onBeforeUnmount(() => { window.removeEventListener('hashchange', onPageChange); clearTimeout(toastTimer) })
</script>

<template>
  <AppLayout :page="page" :theme="state.theme" :save-status="saveStatus" @toggle-theme="state.theme = state.theme === 'dark' ? 'light' : 'dark'">
    <template #actions>
      <div v-if="page === 'studio'" class="export-control">
        <select v-model="exportScale" aria-label="导出分辨率"><option :value="2">2× 高清</option><option :value="4">4× 超清</option></select>
        <button class="button export-button" :disabled="exporting || overflow" @click="studioPage?.exportImage()"><StudioIcon name="download" :size="16" />{{ exporting ? '导出中…' : '导出作品' }}</button>
      </div>
    </template>
    <StudioPage ref="studioPage" :studio="studio" :active="page === 'studio'" v-model:export-scale="exportScale" v-model:exporting="exporting" v-model:overflow="overflow" @notice="notify" />
    <EmperorPage v-if="page === 'emperor'" :state="state" :flip="studio.flip" @edict="fromPalace" @studio="navigate('studio')" />
    <template #overlays><Transition name="toast"><div v-if="toast" class="toast-message" role="status"><StudioIcon name="check" :size="16" />{{ toast }}</div></Transition></template>
  </AppLayout>
</template>
