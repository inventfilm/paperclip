import type { AssetImage } from "@paperclip/shared";
import { api } from "./client";

export const assetsApi = {
  uploadImage: (companyId: string, file: File, namespace?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (namespace && namespace.trim().length > 0) {
      form.append("namespace", namespace.trim());
    }
    return api.postForm<AssetImage>(`/companies/${companyId}/assets/images`, form);
  },
};

