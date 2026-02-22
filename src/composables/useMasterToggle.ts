import { ref, watch } from 'vue'

const includeMaster = ref(localStorage.getItem('includeMaster') === 'true')

watch(includeMaster, (v) => {
  localStorage.setItem('includeMaster', String(v))
})

export function useMasterToggle() {
  return { includeMaster }
}
