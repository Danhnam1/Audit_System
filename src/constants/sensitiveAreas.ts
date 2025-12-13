/**
 * Sensitive Areas Master Data Helper Functions
 * Master data được quản lý bởi Admin qua API
 * Các helper functions này load từ API thay vì hardcode
 */

import { getDepartmentSensitiveAreaByDeptId } from '../api/departmentSensitiveAreas';

/**
 * Get sensitive areas for a department (from API)
 * Returns array of area names (strings)
 */
export const getSensitiveAreasByDepartment = async (deptId: number | string): Promise<string[]> => {
  try {
    const dataArray = await getDepartmentSensitiveAreaByDeptId(deptId);
    return dataArray.map(item => item.sensitiveArea).filter(Boolean);
  } catch (error) {
    console.error('Failed to load sensitive areas for department', deptId, error);
    return [];
  }
};

/**
 * Get default notes for a department (from API)
 * Returns merged notes from all areas
 */
export const getDefaultNotesByDepartment = async (deptId: number | string): Promise<string> => {
  try {
    const dataArray = await getDepartmentSensitiveAreaByDeptId(deptId);
    const notes = dataArray.map(item => item.defaultNotes).filter(Boolean);
    return notes.join(' | ');
  } catch (error) {
    console.error('Failed to load default notes for department', deptId, error);
    return '';
  }
};

/**
 * Get all sensitive areas for multiple departments (from API)
 */
export const getSensitiveAreasByDepartments = async (deptIds: (number | string)[]): Promise<string[]> => {
  try {
    const allAreas = new Set<string>();
    const promises = deptIds.map(deptId => getSensitiveAreasByDepartment(deptId));
    const results = await Promise.all(promises);
    results.forEach(areas => {
      areas.forEach(area => allAreas.add(area));
    });
    return Array.from(allAreas);
  } catch (error) {
    console.error('Failed to load sensitive areas for departments', error);
    return [];
  }
};

/**
 * Get default notes for multiple departments (merge notes) - from API
 */
export const getDefaultNotesByDepartments = async (deptIds: (number | string)[]): Promise<string> => {
  try {
    const promises = deptIds.map(deptId => getDefaultNotesByDepartment(deptId));
    const results = await Promise.all(promises);
    const notes = results.filter(note => note.trim().length > 0);
    return notes.join(' | ');
  } catch (error) {
    console.error('Failed to load default notes for departments', error);
    return '';
  }
};

