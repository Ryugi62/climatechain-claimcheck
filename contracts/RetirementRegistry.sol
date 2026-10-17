// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RetirementRegistry
/// @notice Records which credit-serial ranges have already been used to back a claim.
///         A range that overlaps an earlier range of the same batch is refused, so the
///         same credits cannot back two claims. It does not issue, sell or price anything.
contract RetirementRegistry {
    struct Range {
        uint64 start;
        uint64 end;
        bytes32 claimHash;    // hash of the claim sentence + claimant
        bytes32 evidenceHash; // hash of the public registry record that showed the credits retired
        address attestor;
    }

    error NotOwner();
    error NotAttestor();
    error ZeroAddress();
    error InvalidRange();
    error RangeOverlap(bytes32 batchKey, uint64 existingStart, uint64 existingEnd);

    event Registered(bytes32 indexed batchKey, uint64 start, uint64 end, bytes32 claimHash, bytes32 evidenceHash, address attestor);
    event AttestorChanged(address indexed attestor, bool allowed);
    event OwnershipTransferred(address indexed from, address indexed to);

    address public owner;
    mapping(address => bool) public isAttestor;
    mapping(bytes32 => Range[]) private _ranges;
    mapping(bytes32 => uint256) private _total;

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyAttestor() { if (!isAttestor[msg.sender]) revert NotAttestor(); _; }

    function addAttestor(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        isAttestor[a] = true;
        emit AttestorChanged(a, true);
    }

    function removeAttestor(address a) external onlyOwner {
        isAttestor[a] = false;
        emit AttestorChanged(a, false);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    function register(bytes32 batchKey, uint64 start, uint64 end, bytes32 claimHash, bytes32 evidenceHash) external onlyAttestor {
        if (start == 0 || end < start) revert InvalidRange();
        Range[] storage rows = _ranges[batchKey];
        uint256 n = rows.length;
        for (uint256 i = 0; i < n; i++) {
            Range storage r = rows[i];
            if (start <= r.end && end >= r.start) revert RangeOverlap(batchKey, r.start, r.end);
        }
        rows.push(Range(start, end, claimHash, evidenceHash, msg.sender));
        _total[batchKey] += uint256(end) - uint256(start) + 1;
        emit Registered(batchKey, start, end, claimHash, evidenceHash, msg.sender);
    }

    function conflictsWith(bytes32 batchKey, uint64 start, uint64 end) external view returns (bool) {
        Range[] storage rows = _ranges[batchKey];
        for (uint256 i = 0; i < rows.length; i++) {
            if (start <= rows[i].end && end >= rows[i].start) return true;
        }
        return false;
    }

    function rangeCount(bytes32 batchKey) external view returns (uint256) { return _ranges[batchKey].length; }
    function totalRegistered(bytes32 batchKey) external view returns (uint256) { return _total[batchKey]; }
    function rangeAt(bytes32 batchKey, uint256 i) external view returns (Range memory) { return _ranges[batchKey][i]; }
}
