// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ClawPay Agent Registry (ERC-8004)
 * @notice On-chain identity, reputation, and capability discovery for AI agents on Hedera.
 *
 * Implements the three ERC-8004 registries:
 *   1. Identity Registry  — ERC-721 NFT per agent, tokenURI → agent profile
 *   2. Reputation Registry — on-chain feedback signals (rating + comment hash)
 *   3. Capability Registry — UCP-inspired tool/service declarations for discovery
 *
 * Designed for the Agentic Society: agents register themselves, discover each
 * other, transact via x402/USDC, and build reputation — all on Hedera.
 */

// Minimal ERC-721 interface (no OpenZeppelin dependency to keep deployment simple)
interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external returns (bytes4);
}

contract AgentRegistry {

    // ═══════════════════════════════════════════════════════════════════
    // IDENTITY REGISTRY (ERC-721)
    // ═══════════════════════════════════════════════════════════════════

    string public name = "ClawPay Agent Identity";
    string public symbol = "AGENT";

    uint256 private _nextTokenId = 1;

    // Token ownership
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Agent profile URI (points to JSON with name, capabilities, wallet, etc.)
    mapping(uint256 => string) private _tokenURIs;

    // Reverse lookup: owner address → agent token ID (one agent per address)
    mapping(address => uint256) public agentOf;

    // ═══════════════════════════════════════════════════════════════════
    // REPUTATION REGISTRY
    // ═══════════════════════════════════════════════════════════════════

    struct Feedback {
        uint256 fromAgent;    // token ID of the rater
        uint256 toAgent;      // token ID of the rated agent
        uint8 rating;         // 1-5 stars
        bytes32 commentHash;  // keccak256 of comment (full text stored off-chain/HCS)
        uint64 timestamp;
    }

    // All feedback entries
    Feedback[] public feedbacks;

    // Agent token ID → array of feedback indices
    mapping(uint256 => uint256[]) public agentFeedbackIds;

    // Aggregated reputation
    mapping(uint256 => uint256) public totalRating;
    mapping(uint256 => uint256) public ratingCount;

    // Prevent duplicate ratings per (from, to) pair per day
    mapping(bytes32 => uint64) public lastRatingTime;

    // ═══════════════════════════════════════════════════════════════════
    // CAPABILITY REGISTRY (UCP-inspired)
    // ═══════════════════════════════════════════════════════════════════

    struct Capability {
        string toolName;       // e.g. "hedera_account_deep_dive"
        string description;    // human-readable description
        uint256 priceUsdcAtomic; // price in atomic USDC (6 decimals)
        string mcpEndpoint;    // MCP server URL
        bool active;
    }

    // Agent token ID → capabilities
    mapping(uint256 => Capability[]) public agentCapabilities;

    // Global capability index for discovery: toolName hash → agent token IDs
    mapping(bytes32 => uint256[]) public capabilityProviders;

    // ═══════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════

    // ERC-721 events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // Agent events
    event AgentRegistered(uint256 indexed tokenId, address indexed owner, string uri);
    event AgentProfileUpdated(uint256 indexed tokenId, string uri);
    event FeedbackSubmitted(uint256 indexed fromAgent, uint256 indexed toAgent, uint8 rating);
    event CapabilityAdded(uint256 indexed tokenId, string toolName, uint256 priceUsdcAtomic);
    event CapabilityRemoved(uint256 indexed tokenId, uint256 capIndex);

    // ═══════════════════════════════════════════════════════════════════
    // IDENTITY — Registration & ERC-721
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new agent. Mints an NFT to the caller.
     * @param uri JSON metadata URI (name, capabilities, wallet, HCS topic, etc.)
     */
    function registerAgent(string calldata uri) external returns (uint256) {
        require(agentOf[msg.sender] == 0, "Already registered");
        require(bytes(uri).length > 0, "URI required");

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        _tokenURIs[tokenId] = uri;
        agentOf[msg.sender] = tokenId;

        emit AgentRegistered(tokenId, msg.sender, uri);
        return tokenId;
    }

    /**
     * @notice Update agent profile URI.
     */
    function updateProfile(string calldata uri) external {
        uint256 tokenId = agentOf[msg.sender];
        require(tokenId != 0, "Not registered");
        require(bytes(uri).length > 0, "URI required");

        _tokenURIs[tokenId] = uri;
        emit AgentProfileUpdated(tokenId, uri);
    }

    // ═══════════════════════════════════════════════════════════════════
    // REPUTATION — Feedback submission & querying
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Submit feedback for another agent. Caller must be a registered agent.
     * @param toAgent Token ID of the agent being rated
     * @param rating 1-5 stars
     * @param commentHash keccak256 of the comment text (stored on HCS)
     */
    function submitFeedback(uint256 toAgent, uint8 rating, bytes32 commentHash) external {
        uint256 fromAgent = agentOf[msg.sender];
        require(fromAgent != 0, "Caller not registered");
        require(_owners[toAgent] != address(0), "Target agent not found");
        require(fromAgent != toAgent, "Cannot rate yourself");
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");

        // Rate limit: one rating per (from, to) pair per 24 hours
        bytes32 pairKey = keccak256(abi.encodePacked(fromAgent, toAgent));
        require(
            block.timestamp >= lastRatingTime[pairKey] + 24 hours,
            "Already rated this agent today"
        );
        lastRatingTime[pairKey] = uint64(block.timestamp);

        uint256 feedbackId = feedbacks.length;
        feedbacks.push(Feedback({
            fromAgent: fromAgent,
            toAgent: toAgent,
            rating: rating,
            commentHash: commentHash,
            timestamp: uint64(block.timestamp)
        }));

        agentFeedbackIds[toAgent].push(feedbackId);
        totalRating[toAgent] += rating;
        ratingCount[toAgent] += 1;

        emit FeedbackSubmitted(fromAgent, toAgent, rating);
    }

    /**
     * @notice Get average rating for an agent (scaled by 100 for precision).
     * @return avg Average rating * 100 (e.g. 450 = 4.50 stars)
     * @return count Number of ratings
     */
    function getReputation(uint256 tokenId) external view returns (uint256 avg, uint256 count) {
        count = ratingCount[tokenId];
        if (count == 0) return (0, 0);
        avg = (totalRating[tokenId] * 100) / count;
    }

    /**
     * @notice Get feedback IDs for an agent.
     */
    function getFeedbackIds(uint256 tokenId) external view returns (uint256[] memory) {
        return agentFeedbackIds[tokenId];
    }

    /**
     * @notice Get total number of feedbacks.
     */
    function feedbackCount() external view returns (uint256) {
        return feedbacks.length;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAPABILITIES — UCP-inspired tool discovery
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Add a capability (tool) that this agent offers.
     */
    function addCapability(
        string calldata toolName,
        string calldata description,
        uint256 priceUsdcAtomic,
        string calldata mcpEndpoint
    ) external {
        uint256 tokenId = agentOf[msg.sender];
        require(tokenId != 0, "Not registered");

        agentCapabilities[tokenId].push(Capability({
            toolName: toolName,
            description: description,
            priceUsdcAtomic: priceUsdcAtomic,
            mcpEndpoint: mcpEndpoint,
            active: true
        }));

        bytes32 toolHash = keccak256(bytes(toolName));
        capabilityProviders[toolHash].push(tokenId);

        emit CapabilityAdded(tokenId, toolName, priceUsdcAtomic);
    }

    /**
     * @notice Deactivate a capability.
     */
    function removeCapability(uint256 capIndex) external {
        uint256 tokenId = agentOf[msg.sender];
        require(tokenId != 0, "Not registered");
        require(capIndex < agentCapabilities[tokenId].length, "Invalid index");

        agentCapabilities[tokenId][capIndex].active = false;
        emit CapabilityRemoved(tokenId, capIndex);
    }

    /**
     * @notice Get all capabilities for an agent.
     */
    function getCapabilities(uint256 tokenId) external view returns (Capability[] memory) {
        return agentCapabilities[tokenId];
    }

    /**
     * @notice Find agents that offer a specific tool.
     */
    function findProviders(string calldata toolName) external view returns (uint256[] memory) {
        return capabilityProviders[keccak256(bytes(toolName))];
    }

    /**
     * @notice Get total number of registered agents.
     */
    function totalAgents() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ERC-721 CORE (minimal implementation)
    // ═══════════════════════════════════════════════════════════════════

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function approve(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                require(retval == IERC721Receiver.onERC721Received.selector, "Unsafe recipient");
            } catch {
                revert("Unsafe recipient");
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd  // ERC-721
            || interfaceId == 0x5b5e139f  // ERC-721 Metadata
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    // ═══════════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════════

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "Not owner");
        require(to != address(0), "Transfer to zero address");

        _tokenApprovals[tokenId] = address(0);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        // Update reverse lookup
        agentOf[from] = 0;
        agentOf[to] = tokenId;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _owners[tokenId];
        return (spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender]);
    }
}
