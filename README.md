# Interop Proof of Work
Parallel computation on the superchain. 

## What?
The idea is that there is a coordination contract InteropPow on chain A which the user interacts with directly, and an instance of PowWorker on multiple chains (here just two chains A and B). When the user calls InteropPow, the x-domain messaging system is invoked to trigger PowWorker to mine some nonces (or “results”). The PowWorker then sends the results as concatenated 8 byte strings back to the InteropPow.

 
```mermaid
sequenceDiagram
		actor U as User
		participant IP as InteropPow (A)
		participant Wa as PoWWorker(A)
		participant xA as L2toL2CrossDomainMessenger (A)
    participant R as Relayor
    participant xB as L2toL2CrossDomainMessenger (B)
    participant Wb as PowWorker(B)
      U ->> IP: run(chainIds)
      IP->>xA: sendMessage()
      xA->>R: emit SentMessage"run()"
    par
      R->>xA: relayMessage("run()")
      xA->>Wa: run()
      activate Wa
        Wa ->> xA: relayMessage(reportResults())
      deactivate Wa      
      xA ->> R: emit SentMessage("reportResults()")
      R->> xA: relayMessage("reportResults()")
      xA->>IP: reportResults()
    and
      R->> xB: relayMessage("run()")
      xB->>Wb: run()
      activate Wb
        Wb->>xB: relayMessage"reportResults()"
      deactivate Wb
      xB ->> R: emit SentMessage("reportResults()")
      R->> xB: relayMessage("reportResults()")
      xB->>IP: reportResults()
    end
		
		IP->>U: Emit "All Results" 
```


## Why?

You could load balance your computation across the superchain gas markets. As in, route your computational work to where gas is cheap. You can also get `N` fold speedup, where `N` is the number of chains, for appropriately parallelizable computations. 
