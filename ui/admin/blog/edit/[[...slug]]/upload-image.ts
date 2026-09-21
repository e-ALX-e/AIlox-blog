export async function uploadImage(file: File) {
  const formData = new FormData()

  formData.append('file', file)

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  })

  const data = (await response.json()) as {
    url?: string
    message?: string
  }

  if (!response.ok || data.url == null) {
    throw new Error(data.message ?? '图片上传失败')
  }

  return data.url
}
