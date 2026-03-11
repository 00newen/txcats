import type { CategoryItem } from '@/features/categories/types'

export function buildCategoryTree(categories: CategoryItem[]) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const childrenByParentId = new Map<string, CategoryItem[]>()
  const rootCategories: CategoryItem[] = []

  for (const category of categories) {
    if (category.parentId && categoriesById.has(category.parentId)) {
      const children = childrenByParentId.get(category.parentId) || []
      children.push(category)
      childrenByParentId.set(category.parentId, children)
    } else {
      rootCategories.push(category)
    }
  }

  const sortByName = (left: CategoryItem, right: CategoryItem) => left.name.localeCompare(right.name)
  rootCategories.sort(sortByName)
  for (const children of childrenByParentId.values()) {
    children.sort(sortByName)
  }

  return { categoriesById, childrenByParentId, rootCategories }
}

export function isDescendantCategory(
  categoriesById: Map<string, CategoryItem>,
  candidateDescendantId: string,
  ancestorId: string,
): boolean {
  const visited = new Set<string>()
  let currentId: string | undefined = candidateDescendantId

  while (currentId) {
    if (currentId === ancestorId) {
      return true
    }

    if (visited.has(currentId)) {
      return false
    }

    visited.add(currentId)
    currentId = categoriesById.get(currentId)?.parentId
  }

  return false
}
