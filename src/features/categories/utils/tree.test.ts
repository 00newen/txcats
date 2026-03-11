import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCategoryTree, isDescendantCategory } from './tree'
import type { CategoryItem } from '@/features/categories/types'

const categories: CategoryItem[] = [
  { id: 'root-b', name: 'B', color: '#000', icon: 'layers' },
  { id: 'child-a', name: 'A Child', color: '#111', icon: 'layers', parentId: 'root-a' },
  { id: 'root-a', name: 'A', color: '#222', icon: 'layers' },
  { id: 'grandchild', name: 'Grandchild', color: '#333', icon: 'layers', parentId: 'child-a' },
]

test('buildCategoryTree sorts roots and children by name', () => {
  const tree = buildCategoryTree(categories)

  assert.deepEqual(
    tree.rootCategories.map((category) => category.id),
    ['root-a', 'root-b'],
  )
  assert.deepEqual(
    (tree.childrenByParentId.get('root-a') || []).map((category) => category.id),
    ['child-a'],
  )
})

test('isDescendantCategory detects nested descendants', () => {
  const tree = buildCategoryTree(categories)

  assert.equal(isDescendantCategory(tree.categoriesById, 'grandchild', 'root-a'), true)
  assert.equal(isDescendantCategory(tree.categoriesById, 'root-b', 'root-a'), false)
})
