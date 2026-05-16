import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AdminTask,
  type AdminTaskAttachment,
  type AdminTaskInput,
  type AdminTaskPriority,
  type AdminTaskStatus,
} from "@/lib/api";

export type TaskStatus = AdminTaskStatus;
export type TaskPriority = AdminTaskPriority;
export type TaskAttachment = AdminTaskAttachment;
export type Task = AdminTask;
export type TaskInput = AdminTaskInput;

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.adminTasks.list();
      setTasks(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTask = useCallback(async (input: TaskInput) => {
    const created = await api.adminTasks.create(input);
    setTasks((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateTask = useCallback(async (id: string, changes: Partial<Omit<Task, "id" | "createdAt" | "createdBy">>) => {
    const updated = await api.adminTasks.update(id, changes);
    setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
    return updated;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await api.adminTasks.remove(id);
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const moveTask = useCallback(async (id: string, status: TaskStatus) => {
    return updateTask(id, { status });
  }, [updateTask]);

  return { tasks, loading, refresh, addTask, updateTask, deleteTask, moveTask };
}
