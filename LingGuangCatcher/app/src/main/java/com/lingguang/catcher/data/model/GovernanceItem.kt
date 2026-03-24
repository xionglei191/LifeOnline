package com.lingguang.catcher.data.model

interface GovernanceItem {
    val id: String
    val displayTitle: String
    val displaySummary: String
    val displayBadge: String
    
    fun isPhysicalAction(): Boolean
    
    // Check if it's the same item (for DiffUtil)
    fun isSameAs(other: GovernanceItem): Boolean {
        return this.id == other.id && this.javaClass == other.javaClass
    }
}
