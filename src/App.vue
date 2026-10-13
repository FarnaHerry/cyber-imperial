<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppLayout from './layouts/AppLayout.vue'
import StudioPage from './pages/StudioPage.vue'
import EmperorPage from './pages/EmperorPage.vue'
import TreasuryPage from './pages/TreasuryPage.vue'
import OfficialsPage from './pages/OfficialsPage.vue'
import PalaceMapPage from './pages/PalaceMapPage.vue'
import StudioIcon from './components/StudioIcon.vue'
import { useStudio } from './composables/useStudio'
import { palaceEdict, royalEdict, type DrawRecord } from './core/palace'
import { rankByKey, type Officer } from './core/empire'
import { pageFromHash, type PageKey } from './core/navigation'

const studio = useStudio()
const { state, restored, saveStatus } = studio
const page = ref<PageKey>(pageFromHash(window.location.hash))
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
function navigate(target: PageKey) { window.location.hash = target }
function onPageChange() { page.value = pageFromHash(window.location.hash) }
function fromPalace(record: DrawRecord) {
  state.subject = record.name
  state.text = palaceEdict(record, state.kingdom, state.emperor)
  studioPage.value?.resetTemplate()
  navigate('studio')
  notify(`已为${record.name}拟旨，原有印痕保留`)
}
function fromOfficer(officer: Officer) {
  state.subject = officer.name
  const title = state.rankTitles[officer.rank][officer.role]
  state.text = royalEdict(`奉天承运，赛博皇帝诏曰：今有${officer.name}，${officer.role === 'civil' ? '学识笃厚，勤于政事' : '忠勇果毅，善守山河'}。兹${officer.rank === 'unranked' ? '录为不入流小官' : `授${rankByKey(officer.rank).label}品级，任${title}之职`}。${officer.duty ? `命其${officer.duty}。` : ''}\n\n望卿恪尽职守，不负所托。钦此。`, state.kingdom, state.emperor)
  studioPage.value?.resetTemplate(); navigate('studio'); notify(`已为${officer.name}拟任命旨`)
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
    <TreasuryPage v-else-if="page === 'treasury'" :state="state" @notice="notify" />
    <OfficialsPage v-else-if="page === 'officials'" :state="state" @notice="notify" @edict="fromOfficer" />
    <PalaceMapPage v-else-if="page === 'palace'" :state="state" @notice="notify" @navigate="navigate" />
    <template #overlays><Transition name="toast"><div v-if="toast" class="toast-message" role="status"><StudioIcon name="check" :size="16" />{{ toast }}</div></Transition></template>
  </AppLayout>
</template>
