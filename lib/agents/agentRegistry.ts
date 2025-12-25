// Agent Registry - manages active execution agents
import { ExecutionAgent } from './executionAgent'
import { Task } from './types'

export class AgentRegistry {
  private agents: Map<string, ExecutionAgent> = new Map()
  private agentsByTask: Map<string, string[]> = new Map() // task type -> agent IDs

  register(agent: ExecutionAgent, taskType: string) {
    this.agents.set(agent.getId(), agent)
    
    if (!this.agentsByTask.has(taskType)) {
      this.agentsByTask.set(taskType, [])
    }
    this.agentsByTask.get(taskType)!.push(agent.getId())
    
    console.log(`Registered agent ${agent.getId()} for task type: ${taskType}`)
  }

  getAgent(agentId: string): ExecutionAgent | undefined {
    return this.agents.get(agentId)
  }

  getAgentsByTaskType(taskType: string): ExecutionAgent[] {
    const agentIds = this.agentsByTask.get(taskType) || []
    return agentIds
      .map(id => this.agents.get(id))
      .filter((agent): agent is ExecutionAgent => agent !== undefined)
  }

  removeAgent(agentId: string) {
    const agent = this.agents.get(agentId)
    if (agent) {
      this.agents.delete(agentId)
      
      // Remove from task type mapping
      Array.from(this.agentsByTask.entries()).forEach(([taskType, ids]) => {
        const index = ids.indexOf(agentId)
        if (index > -1) {
          ids.splice(index, 1)
        }
      })
      
      console.log(`Removed agent ${agentId}`)
    }
  }

  getAllAgents(): ExecutionAgent[] {
    return Array.from(this.agents.values())
  }

  clear() {
    this.agents.clear()
    this.agentsByTask.clear()
  }
}

