interface GuideSection {
  title: string;
  content: string[];
}

interface OptimizationTip {
  area: string;
  tip: string;
  command: string;
}

interface DeploymentConfig {
  container: string;
  command: string;
  notes: string[];
}

interface ApiResponse {
  success: boolean;
  data: any;
  timestamp: string;
}

class JetsonCompass {
  private jetpackVersions = {
    "6.0": { cuda: "12.2", tensorrt: "8.6", endOfLife: "2028-06" },
    "5.1.2": { cuda: "11.4", tensorrt: "8.5", endOfLife: "2026-12" },
    "5.0.2": { cuda: "11.4", tensorrt: "8.4", endOfLife: "2026-06" },
    "4.6.3": { cuda: "10.2", tensorrt: "8.0", endOfLife: "2025-01" }
  };

  private powerModes = {
    "0": { name: "MAXN", description: "Maximum performance", power: "50W" },
    "1": { name: "MODEN", description: "Moderate performance", power: "30W" },
    "2": { name: "5W", description: "Power efficiency mode", power: "5W" },
    "3": { name: "10W", description: "Balanced mode", power: "10W" },
    "4": { name: "15W", description: "Performance mode", power: "15W" }
  };

  private deepstreamTemplates = {
    "basic": "deepstream-app -c configs/source4_1080p_dec_infer-resnet_tracker_sgie_tiled_display_int8.txt",
    "multi-stream": "deepstream-app -c configs/source30_1080p_dec_infer-resnet_tracker_sgie_tiled_display_int8.txt",
    "custom": "deepstream-app -c /path/to/your/config.txt"
  };

  constructor() {}

  private createResponse(data: any): Response {
    const response: ApiResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'",
        "Cache-Control": "no-store, max-age=0"
      }
    });
  }

  async getGuide(): Promise<Response> {
    const guide: GuideSection[] = [
      {
        title: "JetPack Management",
        content: [
          "Check current version: sudo apt-cache show nvidia-jetpack",
          "Update packages: sudo apt update && sudo apt upgrade",
          "Clean up: sudo apt autoremove",
          "Kernel management: sudo apt install nvidia-l4t-kernel"
        ]
      },
      {
        title: "System Configuration",
        content: [
          "Check Jetson model: cat /proc/device-tree/model",
          "Monitor clocks: sudo jetson_clocks --show",
          "Check power mode: sudo nvpmodel -q",
          "Thermal monitoring: tegrastats"
        ]
      },
      {
        title: "Storage Optimization",
        content: [
          "Enable zram: sudo systemctl enable nvzramconfig",
          "Clear journal logs: sudo journalctl --vacuum-time=3d",
          "Remove unused kernels: sudo apt purge linux-image-*generic"
        ]
      }
    ];

    return this.createResponse({ guide });
  }

  async getOptimizationTips(): Promise<Response> {
    const tips: OptimizationTip[] = [
      {
        area: "CUDA Optimization",
        tip: "Set CUDA stream priorities",
        command: "export CUDA_DEVICE_MAX_CONNECTIONS=32"
      },
      {
        area: "Memory Management",
        tip: "Enable GPU memory compression",
        command: "sudo nvpmodel -m 0 && sudo jetson_clocks"
      },
      {
        area: "Power Configuration",
        tip: "Switch to MAXN power mode",
        command: "sudo nvpmodel -m 0"
      },
      {
        area: "TensorRT",
        tip: "Use INT8 precision for inference",
        command: "trtexec --onnx=model.onnx --int8 --workspace=2048"
      },
      {
        area: "Container Performance",
        tip: "Enable NVIDIA runtime in Docker",
        command: "docker run --runtime=nvidia --gpus all"
      }
    ];

    const memoryConfig = {
      "swap_management": "sudo fallocate -l 8G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile",
      "zram_config": "echo 50 | sudo tee /proc/sys/vm/swappiness",
      "cache_cleanup": "sync && echo 3 | sudo tee /proc/sys/vm/drop_caches"
    };

    return this.createResponse({ tips, memoryConfig, powerModes: this.powerModes });
  }

  async getDeploymentConfig(): Promise<Response> {
    const deployments: DeploymentConfig[] = [
      {
        container: "l4t-base",
        command: "docker run --runtime nvidia -it --rm --network host nvcr.io/nvidia/l4t-base:r32.7.1",
        notes: ["Base container for JetPack 4.6+", "Includes CUDA 10.2"]
      },
      {
        container: "l4t-ml",
        command: "docker run --runtime nvidia -it --rm --network host nvcr.io/nvidia/l4t-ml:r32.7.1-py3",
        notes: ["Includes PyTorch, TensorFlow", "Ready for ML workloads"]
      },
      {
        container: "deepstream",
        command: "docker run --runtime nvidia -it --rm --network host nvcr.io/nvidia/deepstream:6.0-triton",
        notes: ["DeepStream SDK 6.0", "Includes Triton Inference Server"]
      }
    ];

    const dockerConfig = {
      "daemon_json": {
        "runtimes": {
          "nvidia": {
            "path": "nvidia-container-runtime",
            "runtimeArgs": []
          }
        },
        "default-runtime": "nvidia"
      },
      "setup_command": "sudo systemctl restart docker"
    };

    return this.createResponse({ 
      deployments, 
      dockerConfig, 
      deepstreamTemplates: this.deepstreamTemplates 
    });
  }

  async handleHealth(): Promise<Response> {
    return new Response(JSON.stringify({ 
      status: "healthy", 
      service: "jetson-compass",
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case "/api/guide":
        return this.getGuide();
      
      case "/api/optimize":
        return this.getOptimizationTips();
      
      case "/api/deploy":
        return this.getDeploymentConfig();
      
      case "/health":
        return this.handleHealth();
      
      default:
        return new Response(JSON.stringify({ 
          error: "Endpoint not found",
          available: ["/api/guide", "/api/optimize", "/api/deploy", "/health"]
        }), { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
    }
  }
}

const compass = new JetsonCompass();

export default {
  async fetch(request: Request): Promise<Response> {
    return compass.handleRequest(request);
  }
};
